// Admin dashboard on phones: the net-profit card is answered by the fast admin function (not the
// full app), the sales chart and net profit are kept 45 s per period like the dashboard summary,
// and the copy is dropped when staff change something. The shop remembers the CSRF token so a
// visit signs in again with one request, and retries once if the server refuses it.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { api, dist, ROOT, setTestEnv, fakeModule, callHandler } = require('./_helpers.cjs');
setTestEnv();

const calls = { profit: 0, sales: 0, staffAsked: [] };
fakeModule(api('_lib/auth.js'), {
  requireStaff: async (_req, _res, perms) => {
    calls.staffAsked.push(perms.join(','));
    return { _id: 'me', role: 'admin' };
  },
});
const profitService = require(dist('services/profit.service.js'));
profitService.profitSummary = async (range) => {
  calls.profit++;
  return { range, current: { netProfit: 100 }, previous: { netProfit: 50 } };
};
const dashboardService = require(dist('services/dashboard.service.js'));
dashboardService.salesAnalytics = async (range, withProfit) => {
  calls.sales++;
  return { range, withProfit };
};

const handler = require(api('v1/admin.js'));
const get = (route) => {
  const [r, qs] = route.split('?');
  return callHandler(handler, { url: `/api/v1/admin?__route=${r}${qs ? `&${qs}` : ''}`, headers: {} });
};

test('net profit is answered by the fast function, needs the reports permission, and is kept 45 s per period', async () => {
  const first = await get('profit/summary?days=14');
  assert.equal(first.status, 200);
  assert.equal(first.body.data.range, 14);
  assert.equal(calls.staffAsked.at(-1), 'reports');
  await get('profit/summary?days=14');
  assert.equal(calls.profit, 1, 'second request uses the kept copy');
  await get('profit/summary?days=30');
  assert.equal(calls.profit, 2, 'another period is computed on its own');
});

test('the sales chart is kept 45 s per period', async () => {
  await get('dashboard/sales?days=7');
  await get('dashboard/sales?days=7');
  assert.equal(calls.sales, 1);
  const other = await get('dashboard/sales?days=90');
  assert.equal(other.body.data.range, 90);
  assert.equal(calls.sales, 2);
});

test('every place that drops the dashboard summary drops the kept chart and profit too', () => {
  const src = fs.readFileSync(api('v1/admin.js'), 'utf8');
  const raw = [...src.matchAll(/^\s+dashboardCache = \{ at: 0, data: null \};/gm)].length;
  assert.equal(raw, 1, 'only inside resetDashboardCaches');
  assert.ok([...src.matchAll(/resetDashboardCaches\(\);/g)].length >= 5);
  assert.match(src, /function resetDashboardCaches\(\) \{\s+dashboardCache = \{ at: 0, data: null \};\s+dashboardParts\.clear\(\);/);
});

test('the shop remembers the CSRF token and retries once with a fresh one when refused', () => {
  const client = fs.readFileSync(path.join(ROOT, 'frontend/src/api/client.ts'), 'utf8');
  assert.match(client, /localStorage\.getItem\(CSRF_KEY\)/);
  assert.match(client, /if \(err\.response\?\.status !== 403\) throw err\s+return postRefresh\(await getCsrfToken\(true\)\)/);
  assert.match(client, /export function resetSessionCheck\(\) \{[^}]*rememberCsrf\(null\)/);
});

test('saved dashboard copies are per account and wiped on sign-out or account change', () => {
  const providers = fs.readFileSync(path.join(ROOT, 'frontend/src/app/providers.tsx'), 'utf8');
  assert.match(providers, /queryClient\.clear\(\)\s+\/\/[^\n]*\n\s+clearSavedCopies\(id\)/);
  assert.match(providers, /else if \(id === null\) \{[^}]*clearSavedCopies\(null\)/);
  const saved = fs.readFileSync(path.join(ROOT, 'frontend/src/lib/savedCopy.ts'), 'utf8');
  assert.match(saved, /const keyFor = \(userId: string, key: string\) => `\$\{PREFIX\}\$\{userId\}:\$\{key\}`/);
});
