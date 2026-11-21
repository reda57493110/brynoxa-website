// Services pages in the home / shop / setups look: path, the Brynoxa band (light in light mode),
// panels with the cyan-bar titles, the WhatsApp help band; texts in the three languages.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = path.resolve(import.meta.dirname, '..')
const src = (p: string) => fs.readFileSync(path.join(root, 'frontend/src', p), 'utf8')
const i18n = await import(pathToFileURL(path.join(root, 'frontend/src/i18n/index.ts')).href)
await i18n.loadLocale('fr')
await i18n.loadLocale('ar')

test('Services: path, Brynoxa band with the six services, photo cards in a panel, help band', () => {
  const s = src('pages/store/Services.tsx')
  assert.doesNotMatch(s, /StoreHero/, 'no more photo hero')
  assert.match(s, /aria-label=\{t\('shop\.breadcrumb'\)\}/, 'the path Home › Services')
  assert.match(s, /className="ink relative isolate[^"]*bg-\[#05080b\]/, 'the Brynoxa band, light in light mode')
  assert.match(s, /<span className="ink-glow /, 'its glow is hidden in light mode')
  assert.match(s, /SERVICE_ICON\[s\.id\]/, 'an icon per service')
  assert.match(s, /<HomeSectionHead id="services-grid-heading"/)
  assert.match(s, /grid-cols-\[38%_minmax\(0,1fr\)\][^"]*sm:flex sm:flex-col/, 'phones: photo beside the text, compact')
  assert.match(s, /line-clamp-2 block break-words/, 'service names wrap on phones instead of being cut')
  assert.match(s, /<HomeHelpBand \/>/)
  // Old links /services#warranty still open the service page
  assert.match(s, /navigate\(`\/services\/\$\{legacy\.slug\}`, \{ replace: true \}\)/)
})

test('Service page: band with title, action and photo; steps, questions, terms in panels; other services on the side', () => {
  const s = src('pages/store/ServiceDetail.tsx')
  assert.match(s, /className="ink relative isolate grid[^"]*bg-\[#05080b\]/)
  assert.match(s, /<h1 id="page-heading" className="text-white /, 'title readable in both modes')
  for (const id of ['service-steps', 'service-faq', 'service-terms']) assert.match(s, new RegExp(`<HomeSectionHead id="${id}"`), id)
  assert.match(s, /<details key=\{faq\.q\} open=\{i === 0\}/, 'questions open one by one, the first open')
  assert.match(s, /lg:grid-cols-\[minmax\(0,1fr\)_20rem\]/, 'side column on computers')
  assert.match(s, /lg:sticky lg:top-24/, 'other services stay in view')
  assert.match(s, /<HelpLink guide=\{guide\}/)
  assert.match(s, /<HomeHelpBand \/>/)
})

test('services: an icon for each, the band line in English, French and Darija', () => {
  const site = src('lib/site.ts')
  for (const [id, icon] of Object.entries({ warranty: 'shield', returns: 'refresh', cod: 'banknote', delivery: 'truck', support: 'headphones', repair: 'wrench' })) {
    assert.match(site, new RegExp(`${id}: '${icon}'`), id)
  }
  assert.equal(i18n.translate('en', 'services.bandKicker'), 'Warranty · Returns · Delivery · Repair')
  assert.equal(i18n.translate('fr', 'services.bandKicker'), 'Garantie · Retours · Livraison · Réparation')
  assert.equal(i18n.translate('ar', 'services.bandKicker'), 'الضمان · الإرجاع · التوصيل · الإصلاح')
})
