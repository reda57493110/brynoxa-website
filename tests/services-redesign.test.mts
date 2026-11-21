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
  assert.match(s, /<PageBand\s+crumbs=\{\[\{ label: t\('common\.services'\) \}\]\}/, 'the path Home › Services and the Brynoxa band')
  assert.match(s, /image=\{SERVICES_HERO_IMAGE\}/, 'the services photo stays at the top')
  assert.match(s, /SERVICES_HERO_IMAGE =\s*'https:\/\/images\.unsplash\.com\/photo-1521791136064-7986c2920216/)
  assert.match(s, /className=\{bandPrimaryPill\}[\s\S]*className=\{bandGhostPill\}/, 'Shop now and Contact buttons')
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

test('information pages share the band: path, Brynoxa band (photo kept where the page had one), panels', () => {
  const band = src('components/layout/PageBand.tsx')
  assert.match(band, /'ink relative isolate overflow-hidden[^']*bg-\[#05080b\]/, 'dark band, white in light mode')
  assert.match(band, /<span className="ink-glow /)
  assert.match(band, /aspect-\[16\/7\][^"]*sm:absolute sm:inset-0/, 'phones: photo as a strip above the text; larger screens: text on the photo')
  assert.match(band, /ink-shade-x absolute inset-0 -z-10 hidden sm:block/, 'the shade only when the text is on the photo')
  assert.match(band, /\[800, 1400, 2560\]/, 'phones load a smaller photo')
  const contact = src('pages/store/Contact.tsx')
  assert.doesNotMatch(contact, /StoreHero/)
  assert.match(contact, /image=\{CONTACT_HERO_IMAGE\}/, 'contact keeps its photo')
  assert.match(contact, /<HomeSectionHead id="contact-form-heading"/)
  assert.match(contact, /<HomeSectionHead id="contact-info-heading"/)
  const track = src('pages/store/TrackOrder.tsx')
  assert.match(track, /<PageBand crumbs=\{\[\{ label: t\('orders\.trackOrder'\) \}\]\}/)
  assert.match(track, /<TrackSide \/>/, 'delivery, cash, returns, warranty beside the form')
  assert.match(track, /<HomeHelpBand \/>/)
  const help = src('pages/store/Help.tsx')
  assert.match(help, /<PageBand crumbs=\{\[\{ label: t\('help\.kicker'\) \}\]\}/)
  assert.match(help, /role="search"/, 'the search stays in the band')
  assert.doesNotMatch(help, /max-w-5xl/, 'content as wide as the band')
})

test('cart, checkout, compare, legal pages, order confirmation and the WhatsApp window: the same look', () => {
  const hero = src('components/layout/PageHero.tsx')
  assert.match(hero, /<PageBand crumbs=\{\[\{ label: crumb \?\? \(typeof title === 'string' \? title : ''\) \}\]\}/, 'path and Brynoxa band on every page using the page header')
  for (const p of ['Cart', 'Compare', 'Legal', 'OrderConfirmation', 'Checkout']) assert.match(src(`pages/store/${p}.tsx`), /<PageHero/, p)
  assert.match(src('pages/store/Checkout.tsx'), /<h1 id="page-heading" className="[^"]*font-black uppercase/, 'checkout keeps its compact header, in the same style')
  const wa = src('components/contact/WhatsAppHost.tsx')
  assert.match(wa, /className="ink relative isolate flex items-center/, 'the reply line in the Brynoxa band look')
  assert.match(wa, /btn-shine h-11 w-full rounded-full bg-\[var\(--brand\)\]/, 'the Brynoxa cyan button')
  assert.doesNotMatch(wa, /h-11 w-full rounded-full bg-\[#25D366\]/, 'no more green button')
  assert.match(wa, /shadow-\[inset_0_-3px_0_var\(--brand\)\]/, 'the chosen topic marked like the setups buttons')
})
