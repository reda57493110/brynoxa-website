// "Similar products" under each product: chosen in Admin → Products → Similar products
// (Suggestions with reasons → approve → My choice), saved on the product (`similar`, 8 at most);
// the product page shows the chosen ones (in stock, in order), or else picks them itself.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const root = path.resolve(import.meta.dirname, '..')
const { suggestSimilar, MAX_SIMILAR } = await import(pathToFileURL(path.join(root, 'frontend/src/lib/similarSuggestions.ts')).href)

let n = 0
const p = (o: Record<string, unknown>) => ({
  _id: String(++n),
  name: `P${n}`,
  price: 10000,
  stock: 2,
  isActive: true,
  soldCount: 0,
  category: { _id: 'laptops', slug: 'laptops' },
  brand: { _id: 'hp', slug: 'hp' },
  images: [],
  ...o,
})

test('suggestions: same category, in stock, not itself nor its own versions; closest price and same brand first', () => {
  const main = p({ name: 'Main', price: 10000, variantGroup: 'g1' })
  const list = [
    main,
    p({ name: 'Same brand close', price: 10500 }),
    p({ name: 'Other brand close', price: 9800, brand: { _id: 'asus' } }),
    p({ name: 'Far cheaper', price: 4000, brand: { _id: 'asus' } }),
    p({ name: 'Own version', price: 10000, variantGroup: 'g1' }),
    p({ name: 'Other category', category: { _id: 'monitors' } }),
    p({ name: 'Sold out', price: 10000, stock: 0 }),
    p({ name: 'Hidden', price: 10000, isActive: false }),
  ]
  const s = suggestSimilar(main, list)
  const names = s.map((x: { product: { name: string } }) => x.product.name)
  assert.deepEqual(names, ['Same brand close', 'Other brand close', 'Far cheaper'])
  assert.equal(s[0].reason.kind, 'sameBrand')
  assert.equal(s[1].reason.kind, 'samePrice', 'within 5%: about the same price')
  assert.deepEqual(s[2].reason, { kind: 'cheaper', diff: 6000 })
  assert.equal(MAX_SIMILAR, 8)
})

test('server: saved on the product, 8 at most, never itself; same rule on both server paths', () => {
  const require = createRequire(import.meta.url)
  process.env.JWT_ACCESS_SECRET ||= 'test-access-secret-0123456789abcdef'
  process.env.JWT_REFRESH_SECRET ||= 'test-refresh-secret-0123456789abcdef'
  process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:1/none'
  const { productSchema } = require(path.join(root, 'backend/dist/validators/schemas.js'))
  const ids = Array.from({ length: 9 }, (_, i) => String(i).padStart(24, 'a'))
  const partial = productSchema.partial()
  assert.equal(partial.safeParse({ similar: ids.slice(0, 8) }).success, true)
  assert.equal(partial.safeParse({ similar: ids }).success, false, 'more than 8 refused')
  const svc = fs.readFileSync(path.join(root, 'backend/src/services/catalog.service.ts'), 'utf8')
  assert.ok(svc.includes('product.similar = sanitizeRecommended(data.similar, String(product._id)).slice(0, 8);'))
  assert.ok(fs.readFileSync(path.join(root, 'api/v1/admin.js'), 'utf8').includes("validated('productSchema', await readJsonBody(req), true)"), 'the Vercel path validates with the same schema')
})

test('the page uses the chosen ones first; admin has the tab with Suggestions | My choice', () => {
  const read = (f: string) => fs.readFileSync(path.join(root, 'frontend/src', f), 'utf8')
  const page = read('components/product/SimilarProducts.tsx')
  assert.ok(page.includes('const items = chosen.length ? chosen.slice(0, 8) : automatic'))
  assert.ok(page.includes('p.stock > 0 && p._id !== product._id'), 'chosen ones only when in stock')
  const board = read('components/admin/HomeLayoutBoard.tsx')
  assert.ok(board.includes("const BOARD_TABS: BoardTab[] = ['home', 'setups', 'setup', 'similar']"))
  assert.ok(board.includes('<SimilarAdmin onOpen={onOpen} />'))
  const admin = read('components/admin/SimilarAdmin.tsx')
  assert.ok(admin.includes('suggestSimilar(m, catalog.data)') && admin.includes("save.mutate(kept.map((s) => s.product._id), { onSuccess: () => setView('mine') })"))
})
