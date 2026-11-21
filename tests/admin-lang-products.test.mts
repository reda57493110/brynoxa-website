// Admin languages: Admin → Products (the list, the shop pages board, the placement window, the
// product picker and the placement labels) in English, French and Darija.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = path.resolve(import.meta.dirname, '..')
const src = (p: string) => fs.readFileSync(path.join(root, 'frontend/src', p), 'utf8')
const admin = await import(pathToFileURL(path.join(root, 'frontend/src/i18n/admin.ts')).href)

const holes = (s: string) => (s.match(/\{\w+\}/g) || []).sort().join(',')

test('products texts: French and Darija for every key, same placeholders', () => {
  const en = admin.ADMIN_TEXT.en as Record<string, string>
  const keys = Object.keys(en).filter((k) => k.startsWith('products.'))
  assert.ok(keys.length > 150, String(keys.length))
  for (const lang of ['fr', 'ar'] as const) {
    for (const k of keys) {
      const v = admin.ADMIN_TEXT[lang][k]
      assert.ok(v, `${lang} ${k}`)
      assert.equal(holes(v), holes(en[k]), `${lang} ${k} placeholders`)
    }
  }
  // Every key used in the screen's files exists
  const files = [
    'pages/admin/Products.tsx',
    'components/admin/HomeLayoutBoard.tsx',
    'components/admin/ProductPlacementDialog.tsx',
    'components/admin/ProductAutoPlaces.tsx',
    'components/admin/PageHeaderProducts.tsx',
    'hooks/useStorefrontPlacements.ts',
  ]
  for (const f of files) {
    for (const m of src(f).matchAll(/\b(?:tr|at)\('(products\.[\w.]+)'/g)) assert.ok(en[m[1]], `${f}: ${m[1]}`)
  }
  for (const id of ['gaming', 'study', 'work', 'creator']) assert.ok(en[`products.setup.${id}`], id)
})

test('plain functions follow the admin language', () => {
  admin.setCurrentAdminLang('fr')
  assert.equal(admin.at('products.count', { count: 5 }), '5 produits')
  assert.equal(admin.at('products.under', { amount: '5,000' }), 'Moins de 5,000 DH')
  admin.setCurrentAdminLang('ar')
  assert.equal(admin.at('products.place.category', { name: 'Laptops' }), 'الفئة · Laptops')
  admin.setCurrentAdminLang('en')
  assert.equal(admin.at('products.board.hiddenNeeds', { count: 3 }), 'hidden (needs 3)')
})

test('Products and its parts use the admin texts, no English left in the code', () => {
  const list = src('pages/admin/Products.tsx')
  assert.match(list, /const tr = useAdminT\(\)/)
  assert.doesNotMatch(list, />Products<\/h1>|placeholder="Name or SKU"|title="Delete product\?"|>Storefront order</)
  assert.doesNotMatch(list, /text-left|text-right/, 'logical text alignment for Arabic')
  const board = src('components/admin/HomeLayoutBoard.tsx')
  assert.match(board, /const tr = useAdminT\(\)/)
  assert.doesNotMatch(board, /title="Deals of the moment"|>Our brands<|'Setups page updated'|\/hidden\/\.test/)
  assert.match(board, /name="chevron-left" size=\{14\} className="rtl:rotate-180"/, 'arrows turn in Arabic')
  assert.match(src('components/admin/ProductPlacementDialog.tsx'), /const tr = useAdminT\(\)/)
  assert.match(src('components/admin/ProductAutoPlaces.tsx'), /at\('products\.auto\.stock0'\)/)
  assert.match(src('components/admin/PageHeaderProducts.tsx'), /tr\('products\.search\.placeholder'\)/)
  assert.match(src('hooks/useStorefrontPlacements.ts'), /at\('products\.place\.deals'\)/)
})
