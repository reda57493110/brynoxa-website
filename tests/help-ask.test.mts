// Help assistant: the customer types anything — English, French, Darija in Arabic or Latin letters,
// with typos — and gets the best answer first; nothing found = one tap to ask us on WhatsApp with
// the question written in. Arabic help content is in Moroccan Darija.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const load = async (rel: string) => import(pathToFileURL(path.join(root, 'frontend/src', rel)).href);
const { searchHelp, expandHelpWord, questionWords } = await load('lib/help/search.ts');
const { en } = await load('lib/help/en.ts');
const { fr } = await load('lib/help/fr.ts');
const { ar } = await load('lib/help/ar.ts');
const first = (g: unknown, q: string) => searchHelp(g, q).topics[0]?.topic.id;

test('the best answer first, whatever the words', () => {
  assert.equal(first(en, 'where is my order'), 'track-order');
  assert.equal(first(en, 'how much is shipping'), 'delivery-fees');
  assert.equal(first(en, 'my laptop is broken'), 'warranty-claim');
  assert.equal(first(fr, 'mot de passe oublié'), 'password');
  assert.equal(first(fr, 'annuler commande'), 'change-order');
});

test('Darija in Latin letters and in Arabic letters', () => {
  assert.equal(first(fr, 'fin wslat commande dyali'), 'track-order');
  assert.equal(first(fr, 'chhal livraison'), 'delivery-fees');
  assert.equal(first(fr, 'kifach nkhles'), 'cod');
  assert.equal(first(fr, 'bghit nrja3 produit'), 'request-return');
  assert.equal(first(ar, 'فين وصلات الكوموند ديالي'), 'track-order');
  assert.equal(first(ar, 'شحال التوصيل'), 'delivery-fees');
  assert.equal(first(ar, 'بغيت نرجع المنتوج'), 'request-return');
  assert.equal(first(ar, 'نسيت المودباس'), 'password');
  assert.equal(first(ar, 'ch7al tawsil'), 'delivery-fees');
});

test('typing mistakes; words that mean nothing are ignored; unrelated text finds nothing', () => {
  assert.equal(first(en, 'refnd'), 'request-return');
  assert.ok(searchHelp(en, 'delivry time').faqs.some((f: { id: string }) => f.id === 'faq-delivery-time'));
  assert.deepEqual(questionWords('kifach nkhles'), ['nkhles']);
  assert.deepEqual(questionWords('comment je peux annuler'), ['annuler']);
  assert.ok(expandHelpWord('chhal').includes('prix'), 'chhal = price');
  assert.deepEqual(searchHelp(en, 'pizza recipe'), { topics: [], faqs: [] });
  assert.deepEqual(searchHelp(ar, 'pizza'), { topics: [], faqs: [] });
});

test('the Help button has the question box; no answer = WhatsApp with the question written in', () => {
  const panel = fs.readFileSync(path.join(root, 'frontend/src/components/help/HelpPanel.tsx'), 'utf8');
  assert.ok(panel.includes('<HelpAsk guide={content.data} onNavigate={close} />'));
  assert.ok(panel.includes("openWhatsAppChat(composeWhatsAppMessage([t('help.waAsk'), query.trim()]))"));
  const page = fs.readFileSync(path.join(root, 'frontend/src/pages/store/Help.tsx'), 'utf8');
  assert.ok(page.includes("openWhatsApp(composeWhatsAppMessage([t('help.waAsk'), query.trim()]))"), 'the Help Center too');
  for (const l of ['en', 'fr', 'ar']) {
    const t = fs.readFileSync(path.join(root, `frontend/src/i18n/${l}.ts`), 'utf8');
    for (const k of ['askTitle', 'askPlaceholder', 'notThis', 'askNoAnswer', 'askWhatsApp', 'waAsk']) assert.ok(t.includes(`    ${k}: "`), `${l}: ${k}`);
  }
});

test('Arabic help is in Moroccan Darija, not standard Arabic', () => {
  const guide = JSON.stringify(ar);
  for (const darija of ['كيفاش', 'الكوموند', 'ديال']) assert.ok(guide.includes(darija), darija);
  const ui = fs.readFileSync(path.join(root, 'frontend/src/i18n/ar.ts'), 'utf8');
  const help = ui.slice(ui.indexOf('\n  help: {'), ui.indexOf('\n  services: {'));
  assert.ok(help.includes('heading: "كيفاش نقدرو نعاونوك؟"'));
  assert.ok(!help.includes('كيف يمكننا مساعدتك'), 'no more standard Arabic heading');
});

test('Help Center on phones: compact guide cards, steps and "Still need help?"', () => {
  const guide = fs.readFileSync(path.join(root, 'frontend/src/components/help/QuickGuide.tsx'), 'utf8');
  assert.ok(guide.includes('relative flex gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-2.5 sm:flex-col'), 'small step boxes on phones');
  assert.ok(guide.includes('text-[12.5px] leading-snug text-[var(--fg-muted)] sm:text-sm'), 'small step text on phones');
  const page = fs.readFileSync(path.join(root, 'frontend/src/pages/store/Help.tsx'), 'utf8');
  assert.ok(page.includes("className={cn(surfaceCard, 'mt-3 p-3 sm:p-6')}"), 'guide box');
  assert.ok(!page.includes('{guide.title}</h3>'), 'no guide title: the selected tab says it');
  assert.ok(page.includes("'flex flex-col gap-3 p-3.5 sm:flex-row"), '"Still need help?" card');
});
