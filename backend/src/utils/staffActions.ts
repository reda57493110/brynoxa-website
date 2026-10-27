/**
 * Turns a staff request (method + path under /api/v1) into a readable line for the staff activity
 * log. Returns null for requests not worth listing (photo uploads, previews).
 */
export type StaffActionInfo = { action: string; kind: string; targetId?: string };

type Rule = { rx: RegExp; methods?: string[]; action: string | ((method: string) => string); kind: string };

const crud = (thing: string) => (m: string) => (m === 'POST' ? `Added ${thing}` : m === 'DELETE' ? `Deleted ${thing}` : `Edited ${thing}`);

// First match wins; the first capture group is the id of what was changed
const RULES: Rule[] = [
  { rx: /^admin\/(upload|products\/import-photos|setup-preview|email-test|push\/test)/, action: '', kind: 'skip' },
  { rx: /^admin\/orders\/([^/]+)\/status$/, action: 'Changed an order status', kind: 'order-status' },
  { rx: /^admin\/orders\/([^/]+)\/contacts$/, action: 'Logged a call / message', kind: 'order-contact' },
  { rx: /^admin\/orders\/([^/]+)\/(deposit|deposit-proofs)/, action: 'Updated a deposit', kind: 'order' },
  { rx: /^admin\/orders\/([^/]+)\/refunds/, action: 'Recorded a refund', kind: 'order' },
  { rx: /^admin\/orders\/([^/]+)\/returns?/, action: 'Registered returned items', kind: 'order' },
  { rx: /^admin\/orders\/([^/]+)\/costs/, action: 'Set the costs of an order', kind: 'order' },
  { rx: /^admin\/orders$/, methods: ['POST'], action: 'Added an order', kind: 'order' },
  { rx: /^admin\/orders\/([^/]+)$/, methods: ['DELETE'], action: 'Deleted an order', kind: 'order' },
  { rx: /^admin\/orders\/([^/]+)/, action: 'Updated an order', kind: 'order' },
  { rx: /^admin\/(deposits|deposit-payments)/, action: 'Recorded a payment', kind: 'order' },
  { rx: /^admin\/products\/move-photos/, action: 'Moved photos to Cloudinary', kind: 'catalog' },
  { rx: /^admin\/products\/([^/]+)\/variants/, action: 'Edited product versions', kind: 'product' },
  { rx: /^admin\/products\/([^/]+)\/(stock|inventory)/, action: 'Changed stock', kind: 'product' },
  { rx: /^admin\/products\/([^/]+)$/, action: crud('a product'), kind: 'product' },
  { rx: /^admin\/products$/, action: crud('a product'), kind: 'product' },
  { rx: /^admin\/products\/([^/]+)/, action: 'Edited a product', kind: 'product' },
  { rx: /^admin\/categories/, action: crud('a category'), kind: 'catalog' },
  { rx: /^admin\/brands/, action: crud('a brand'), kind: 'catalog' },
  { rx: /^admin\/inventory\/products\/([^/]+)\/listing/, action: 'Put units up for sale', kind: 'product' },
  { rx: /^admin\/setup/, action: 'Edited "Complete your setup" picks', kind: 'catalog' },
  { rx: /^admin\/deposit-methods/, action: 'Changed payment details', kind: 'settings' },
  { rx: /^admin\/(inventory\/)?receipts/, action: 'Received stock from a supplier', kind: 'inventory' },
  { rx: /^admin\/(inventory\/)?repairs/, action: 'Updated a repair', kind: 'inventory' },
  { rx: /^admin\/(inventory\/)?returns/, action: 'Handled a return', kind: 'inventory' },
  { rx: /^admin\/(inventory|stock)/, action: 'Changed stock', kind: 'inventory' },
  { rx: /^admin\/(customers|wholesale)\/([^/]+)/, action: 'Updated a customer', kind: 'customer' },
  { rx: /^admin\/(customers|wholesale)/, action: 'Updated customers', kind: 'customer' },
  { rx: /^admin\/coupons/, action: crud('a coupon'), kind: 'marketing' },
  { rx: /^admin\/push/, action: 'Sent a push notification', kind: 'marketing' },
  { rx: /^admin\/emails/, action: 'Sent an email to a customer', kind: 'message' },
  { rx: /^admin\/(messages|contacts?)/, action: 'Handled a customer message', kind: 'message' },
  { rx: /^admin\/(profit|expenses|courier-costs|product-costs)/, action: 'Changed costs / expenses', kind: 'money' },
  { rx: /^admin\/users\/([^/]+)\/password/, action: 'Set a staff password', kind: 'staff' },
  { rx: /^admin\/users\/([^/]+)\/verify-email/, action: 'Helped a staff member verify their email', kind: 'staff' },
  { rx: /^admin\/(users|roles|staff)/, action: 'Changed staff accounts', kind: 'staff' },
  { rx: /^(admin\/)?settings/, action: 'Changed store settings', kind: 'settings' },
  { rx: /^admin\/home/, action: 'Changed the home page', kind: 'settings' },
];

/** `path`: under /api/v1, without the query (e.g. "admin/orders/123/status"). */
export function describeStaffAction(method: string, path: string): StaffActionInfo | null {
  const m = method.toUpperCase();
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return null;
  const clean = path.replace(/^\/+|\/+$/g, '').replace(/^api\/v1\//, '');
  for (const rule of RULES) {
    if (rule.methods && !rule.methods.includes(m)) continue;
    const hit = clean.match(rule.rx);
    if (!hit) continue;
    if (rule.kind === 'skip') return null;
    // The id is the last capture that looks like a database id
    const targetId = hit.slice(1).reverse().find((g) => g && /^[a-f0-9]{24}$/i.test(g));
    return { action: typeof rule.action === 'string' ? rule.action : rule.action(m), kind: rule.kind, targetId };
  }
  return { action: 'Made a change', kind: 'other' };
}

/** Path under /api/v1 of a request, also when Vercel rewrote it to ?__route= / ?__resource= / ?__path=. */
export function logicalApiPath(url: string): string {
  const [pathname, qs = ''] = url.split('?');
  const q = new URLSearchParams(qs);
  if (q.get('__path') !== null) return String(q.get('__path')).replace(/^\/+/, '');
  const base = pathname.replace(/^\/api\/v1\/?/, '').replace(/^\/api\/?/, '').replace(/\/+$/, '');
  const resource = q.get('__resource') || base;
  const route = q.get('__route');
  return [resource, route].filter(Boolean).join('/').replace(/\/{2,}/g, '/');
}
