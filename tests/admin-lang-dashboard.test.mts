// Admin languages, step 2: the Dashboard and the texts shared by every screen (order statuses,
// payment, status groups, order buttons, delivery problems) in English, French and Darija; plain
// functions (status labels) follow the chosen language; the screen redraws when it changes.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = path.resolve(import.meta.dirname, '..')
const src = (p: string) => fs.readFileSync(path.join(root, 'frontend/src', p), 'utf8')
const admin = await import(pathToFileURL(path.join(root, 'frontend/src/i18n/admin.ts')).href)
const status = await import(pathToFileURL(path.join(root, 'frontend/src/lib/orderStatus.ts')).href)

const holes = (s: string) => (s.match(/\{\w+\}/g) || []).sort().join(',')

test('dashboard and shared texts: French and Darija for every key, same placeholders', () => {
  const en = admin.ADMIN_TEXT.en as Record<string, string>
  const keys = Object.keys(en).filter((k) => /^(dash|status|group\.(processing|delivery|completed|returns|closed)|move|issue|pay|kit|chart|common)\./.test(k))
  assert.ok(keys.length > 100, String(keys.length))
  for (const lang of ['fr', 'ar'] as const) {
    for (const k of keys) {
      const v = admin.ADMIN_TEXT[lang][k]
      assert.ok(v, `${lang} ${k}`)
      assert.equal(holes(v), holes(en[k]), `${lang} ${k} placeholders`)
    }
  }
})

test('status labels and lists follow the admin language', () => {
  admin.setCurrentAdminLang('fr')
  assert.equal(status.orderStatusLabel('shipped'), 'Expédiée')
  assert.equal(status.ORDER_GROUPS[0].label, 'En traitement')
  assert.equal(status.TRANSITION_LABEL.delivered, 'Marquer livrée')
  assert.equal(status.deliveryIssueLabel('refused'), 'Le client a refusé le colis')
  admin.setCurrentAdminLang('ar')
  assert.equal(status.orderStatusLabel('delivered'), 'توصلات')
  admin.setCurrentAdminLang('en')
  assert.equal(status.orderStatusLabel('delivered'), 'Delivered')
  assert.equal(status.orderStatusLabel('some_new_status'), 'some new status', 'an unknown status shows as written')
})

test('the dashboard, the analytics kit and the chart use the admin texts; the screen redraws on a language change', () => {
  const dash = src('pages/admin/Dashboard.tsx')
  assert.match(dash, /const tr = useAdminT\(\)/)
  assert.doesNotMatch(dash, /title="Dashboard"|label="Average sale"|>No orders yet\.</, 'no English left in the code')
  assert.match(src('components/admin/analytics/Kit.tsx'), /at\('kit\.vs'/)
  assert.match(src('components/admin/SalesChart.tsx'), /at\('chart\.average'/)
  assert.match(src('store/adminLangStore.ts'), /useAdminLangStore\.subscribe\(\(s\) => setCurrentAdminLang\(s\.lang\)\)/)
  assert.match(src('app/layouts/AdminLayout.tsx'), /<Outlet key=\{adminLang\} \/>/)
})
