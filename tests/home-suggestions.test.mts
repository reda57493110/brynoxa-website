// Admin → Products → home page board → "Suggestions": each section gets the products that fit it,
// with the reason; staff approve them (they become "My choice"). Also: the server keeps 8 banner
// products and 24 per row (it used to cut them to 4 and 12).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = path.resolve(import.meta.dirname, '..')
const { suggestHome } = await import(pathToFileURL(path.join(root, 'frontend/src/lib/homeSuggestions.ts')).href)

const NOW = Date.parse('2026-11-23T12:00:00Z')
const day = (n: number) => new Date(NOW - n * 86_400_000).toISOString()
let n = 0
const p = (o: Record<string, unknown>) => ({
  _id: String(++n).padStart(24, '0'),
  name: `P${n}`,
  price: 5000,
  stock: 3,
  isActive: true,
  isFeatured: false,
  soldCount: 0,
  createdAt: day(200),
  category: { _id: 'laptops', slug: 'laptops' },
  brand: { slug: 'hp' },
  images: [],
  ...o,
})
const laptops = { _id: 'laptops', slug: 'laptops' }
const pcs = { _id: 'pcs', slug: 'gaming-pcs' }
const gear = { _id: 'gear', slug: 'accessories' }

const catalog = [
  p({ name: 'Big deal laptop', compareAtPrice: 7000, price: 5000, category: laptops }), // −28%
  p({ name: 'Small deal laptop', compareAtPrice: 5300, price: 5000, category: laptops }), // −5%
  p({ name: 'Third laptop deal', compareAtPrice: 6000, price: 5000, category: laptops }), // −16%
  p({ name: 'PC deal', compareAtPrice: 22000, price: 18000, category: pcs }),
  p({ name: 'Best seller PC', price: 15000, soldCount: 40, category: pcs }),
  p({ name: 'New mouse', price: 300, createdAt: day(2), category: gear }),
  p({ name: 'Brynoxa PC', price: 12000, brand: { slug: 'brynoxa' }, soldCount: 5, category: pcs }),
  p({ name: 'Hidden deal', compareAtPrice: 9000, price: 1000, isActive: false }),
  p({ name: 'Sold out deal', compareAtPrice: 9000, price: 1000, stock: 0 }),
]
const names = (list: { product: { name: string } }[]) => list.map((s) => s.product.name)
const budgets = [
  { key: 'budget-small', max: 5000 },
  { key: 'budget-high', min: 10000 },
]
const s = suggestHome(catalog, budgets, { banner: 8, featured: 12, row: 24 }, NOW)

test('only active products in stock are ever suggested', () => {
  const all = [...s.banner, ...s.deals, ...s.featured, ...s.carousel, ...s.new, ...s.signature, ...Object.values(s.budget).flat()] as { product: { name: string } }[]
  assert.ok(!all.some((x) => x.product.name === 'Hidden deal' || x.product.name === 'Sold out deal'))
})

test('deals banner: the best deals first, at most 2 per category, then filled with best sellers / high-end', () => {
  const b = names(s.banner)
  assert.equal(b[0], 'Big deal laptop')
  assert.ok(b.indexOf('PC deal') < b.indexOf('Best seller PC'), 'deals before the fill')
  // 3 laptop deals exist: the third comes only after the other categories
  assert.ok(b.indexOf('Small deal laptop') > b.indexOf('PC deal'))
  assert.equal(s.banner[0].reason.kind, 'deal')
  assert.equal(s.banner[0].reason.pct, 29)
  assert.equal(s.banner[0].reason.saved, 2000)
})

test('deals of the moment: every deal, biggest discount first', () => {
  assert.deepEqual(names(s.deals), ['Big deal laptop', 'PC deal', 'Third laptop deal', 'Small deal laptop'])
})

test('new arrivals: newest first; Signature: Brynoxa only; budgets: only the price band', () => {
  assert.equal(names(s.new)[0], 'New mouse')
  assert.deepEqual(s.new[0].reason, { kind: 'new', days: 2 })
  assert.deepEqual(names(s.signature), ['Brynoxa PC'])
  assert.ok(names(s.budget['budget-small']).every((x) => ['Big deal laptop', 'Small deal laptop', 'Third laptop deal', 'New mouse'].includes(x)))
  assert.ok(names(s.budget['budget-high']).includes('Best seller PC'))
})

test('top picks: best sellers rank high; the "after" list never repeats the first one', () => {
  assert.ok(names(s.featured).slice(0, 3).includes('Best seller PC'))
  const first = new Set(names(s.featured))
  assert.ok(names(s.carousel).every((x) => !first.has(x)))
})

test('reasons by price: "high-end" only for expensive products, "good value" below', () => {
  const cheap = suggestHome([p({ name: 'Cable', price: 190, category: gear })], [], { banner: 8, featured: 12, row: 24 }, NOW)
  assert.equal(cheap.banner[0].reason.kind, 'value')
  const pricey = suggestHome([p({ name: 'Workstation', price: 30000, category: pcs })], [], { banner: 8, featured: 12, row: 24 }, NOW)
  assert.equal(pricey.banner[0].reason.kind, 'flagship')
})

test('the board: Suggestions | My choice on every section, approve saves "My choice"; server keeps 8 / 24', () => {
  const read = (f: string) => fs.readFileSync(path.join(root, f), 'utf8')
  const board = read('frontend/src/components/admin/HomeLayoutBoard.tsx')
  for (const k of ['banner', 'deals', 'featured', 'carousel', 'new', 'signature']) assert.ok(board.includes(`suggestions={sug?.${k}}`), k)
  assert.ok(board.includes('suggestions={sug?.budget[b.key]}'))
  assert.ok(board.includes("save.mutate({ next: kept.map((s) => s.product._id) }, { onSuccess: () => setView('mine') })"))
  assert.ok(board.includes('const dropped = removed ? [removed] : ids.filter((id) => !next.includes(id))'), 'top picks: products left out lose the flag')
  const settings = read('backend/src/models/Settings.ts')
  assert.ok(settings.includes('export const MAX_HOME_DEALS = 8;') && settings.includes('export const MAX_HOME_ROW = 24;'))
})
