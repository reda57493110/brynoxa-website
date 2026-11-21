// Admin languages: Admin → Orders (the list and Deposits & payments) in English, French and Darija.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = path.resolve(import.meta.dirname, '..')
const src = (p: string) => fs.readFileSync(path.join(root, 'frontend/src', p), 'utf8')
const admin = await import(pathToFileURL(path.join(root, 'frontend/src/i18n/admin.ts')).href)

const holes = (s: string) => (s.match(/\{\w+\}/g) || []).sort().join(',')

test('orders texts: French and Darija for every key, same placeholders', () => {
  const en = admin.ADMIN_TEXT.en as Record<string, string>
  const keys = Object.keys(en).filter((k) => k.startsWith('orders.'))
  assert.ok(keys.length > 80, String(keys.length))
  for (const lang of ['fr', 'ar'] as const) {
    for (const k of keys) {
      const v = admin.ADMIN_TEXT[lang][k]
      assert.ok(v, `${lang} ${k}`)
      assert.equal(holes(v), holes(en[k]), `${lang} ${k} placeholders`)
    }
  }
})

test('the orders screen uses the admin texts', () => {
  const page = src('pages/admin/Orders.tsx')
  assert.match(page, /import \{ useAdminT \} from '@\/store\/adminLangStore'/)
  assert.match(page, /const tr = useAdminT\(\)/)
  assert.doesNotMatch(page, />No orders found\.<|placeholder="Order #, name or phone"|title="Delete order\?"/, 'no English left in the code')
  const deposits = src('components/admin/DepositsView.tsx')
  assert.match(deposits, /const tr = useAdminT\(\)/)
  assert.doesNotMatch(deposits, />Deposits & payments<|title="Deposits"/)
})

test('every "needs attention" reason from lib/orderStatus.ts has a translation on the orders screen', () => {
  const reasons = [...src('lib/orderStatus.ts').matchAll(/reasons\.push\('([^']+)'\)/g)].map((m) => m[1])
  assert.ok(reasons.length >= 5)
  const page = src('pages/admin/Orders.tsx')
  for (const r of reasons) assert.ok(page.includes(`'${r}': 'orders.`), r)
})

test('every order source has a translated label', () => {
  const origins = src('lib/orderOrigin.ts').match(/ORDER_ORIGIN_LABEL[^{]*\{([^}]*)\}/)![1]
  for (const [, id] of origins.matchAll(/(\w+):/g)) {
    for (const lang of ['en', 'fr', 'ar'] as const) assert.ok(admin.ADMIN_TEXT[lang][`orders.origin.${id}`], `${lang} ${id}`)
  }
})
