const path = require('path');
const { connectMongo } = require('../_lib/mongo');
const { sendJson, readJsonBody, sendError, cachePublic } = require('../_lib/http');
const { requireStaff } = require('../_lib/auth');

const backendNodeModules = path.join(__dirname, '../../backend/node_modules');
if (!module.paths.includes(backendNodeModules)) {
  module.paths.unshift(backendNodeModules);
}

const ALLOWED_FIELDS = [
  'storeName',
  'currency',
  'shippingFlatRate',
  'freeShippingMin',
  'shippingByCity',
  'taxRate',
  'supportEmail',
  'depositInstructions',
  'depositMethods',
  'emailNotifications',
  'emailMessages',
  'wholesaleTiers',
  'customerSegments',
  'inventoryStatuses',
  'inventoryLocations',
  'requireInspection',
  'notifyStaffLoginEmail',
  'pageHeroProducts',
  'homeDeals',
];

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      await connectMongo();
      const { getSettings, publicSettings } = require('../../backend/dist/models/Settings');
      const settings = await getSettings();
      cachePublic(res);
      sendJson(res, 200, { success: true, message: 'Success', data: publicSettings(settings) });
      return;
    }

    if (req.method === 'PATCH') {
      const user = await requireStaff(req, res, ['settings', 'products:write']);
      if (!user) return;

      const body = await readJsonBody(req);
      // Catalog staff: only where products show in the shop (home deals, shop page header)
      const { hasPermission } = require('../../backend/dist/permissions');
      const { STOREFRONT_SETTINGS } = require('../../backend/dist/middleware/auth');
      const keys = Object.keys(body && typeof body === 'object' ? body : {});
      if (!hasPermission(user.role, 'settings') && !(keys.length && keys.every((k) => STOREFRONT_SETTINGS.includes(k)))) {
        sendJson(res, 403, { success: false, message: 'You do not have permission for this action' });
        return;
      }
      // Same checks as the Express route: plain values (no negative tax or shipping, real email)
      // and every row (tiers, statuses, payment methods…). A bad row is refused, never dropped.
      const { settingsUpdateSchema, settingsScalarsSchema, settingsIssueMessage } = require('../../backend/dist/validators/schemas');
      const checked = settingsUpdateSchema.safeParse(body ?? {});
      if (!checked.success) {
        sendJson(res, 400, { success: false, message: settingsIssueMessage(checked.error.issues?.[0]) });
        return;
      }
      for (const key of Object.keys(settingsScalarsSchema.shape)) {
        if (checked.data[key] !== undefined) body[key] = checked.data[key];
      }
      const {
        getSettings,
        sanitizePageHeroProducts,
        sanitizeHomeDeals,
        sanitizeDepositMethods,
        sanitizeEmailNotifications,
        sanitizeEmailMessages,
        sanitizeSegmentSettings,
        sanitizeInventoryStatuses,
        sanitizeLocations,
      } = require('../../backend/dist/models/Settings');
      const { sanitizeWholesaleTiers } = require('../../backend/dist/utils/wholesale');
      const settings = await getSettings();

      for (const key of ALLOWED_FIELDS) {
        if (body[key] === undefined) continue;
        if (key === 'shippingByCity') {
          settings[key] = sanitizeShippingByCity(body[key]);
        } else if (key === 'emailNotifications') {
          settings[key] = sanitizeEmailNotifications(body[key], settings.emailNotifications);
        } else if (key === 'inventoryStatuses') {
          settings[key] = sanitizeInventoryStatuses(body[key]);
        } else if (key === 'inventoryLocations') {
          settings[key] = sanitizeLocations(body[key]);
        } else if (key === 'requireInspection') {
          settings[key] = Boolean(body[key]);
        } else if (key === 'wholesaleTiers') {
          settings[key] = sanitizeWholesaleTiers(body[key]);
        } else if (key === 'customerSegments') {
          settings[key] = sanitizeSegmentSettings(body[key], settings.customerSegments);
        } else if (key === 'emailMessages') {
          settings[key] = sanitizeEmailMessages(body[key], settings.emailMessages);
        } else if (key === 'depositInstructions') {
          settings[key] = String(body[key]).slice(0, 2000);
        } else if (key === 'depositMethods') {
          settings[key] = sanitizeDepositMethods(body[key]);
        } else if (key === 'homeDeals') {
          settings[key] = sanitizeHomeDeals(body[key]);
        } else if (key === 'pageHeroProducts') {
          settings[key] = sanitizePageHeroProducts(body[key], settings.pageHeroProducts);
        } else {
          settings[key] = body[key];
        }
      }
      if (body.depositMethods !== undefined || body.depositInstructions !== undefined) {
        const { stampPaymentDetailsChange } = require('../../backend/dist/utils/paymentDetailsAudit');
        await stampPaymentDetailsChange(settings, user._id.toString());
      }
      await settings.save();

      sendJson(res, 200, {
        success: true,
        message: 'Settings updated',
        data: settings,
      });
      return;
    }

    sendJson(res, 405, { success: false, message: 'Method not allowed' });
  } catch (err) {
    console.error('Fast settings failed:', err);
    sendError(res, err);
  }
};

function sanitizeShippingByCity(rows) {
  if (!Array.isArray(rows)) return [];
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const city = String(row.city || '').trim();
    const rate = Number(row.rate);
    if (city.length < 2 || !Number.isFinite(rate) || rate < 0) continue;
    const key = city.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ city, rate });
  }
  return out.slice(0, 200);
}
