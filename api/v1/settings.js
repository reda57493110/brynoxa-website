const path = require('path');
const { connectMongo } = require('../_lib/mongo');
const { sendJson, readJsonBody, sendError } = require('../_lib/http');
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
      sendJson(res, 200, { success: true, message: 'Success', data: publicSettings(settings) });
      return;
    }

    if (req.method === 'PATCH') {
      const user = await requireStaff(req, res, ['settings']);
      if (!user) return;

      const body = await readJsonBody(req);
      // Plain values must be valid (no negative tax or shipping, real email)
      const { settingsScalarsSchema } = require('../../backend/dist/validators/schemas');
      const scalars = settingsScalarsSchema.safeParse(
        Object.fromEntries(Object.keys(settingsScalarsSchema.shape).filter((k) => body?.[k] !== undefined).map((k) => [k, body[k]]))
      );
      if (!scalars.success) {
        const issue = scalars.error.issues?.[0];
        sendJson(res, 400, { success: false, message: `${issue?.path?.join('.') || 'settings'}: ${issue?.message || 'Invalid value'}` });
        return;
      }
      Object.assign(body, scalars.data);
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
