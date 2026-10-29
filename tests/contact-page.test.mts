// Contact page: the order-number example looks like a real order number (BRX-YYYYMMDD-XXXXXX, same
// letters as the server uses), and "Track my order" works for guests (Track order page) as well as
// signed-in customers (their order list).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const src = path.join(root, 'frontend/src');
const load = async (rel: string) => import(pathToFileURL(path.join(src, rel)).href);

const server = fs.readFileSync(path.join(root, 'backend/src/services/order.service.ts'), 'utf8');
const chars = server.match(/ORDER_CODE_CHARS = '([A-Z0-9]+)'/)![1];
const realNumber = new RegExp(`^BRX-\\d{8}-[${chars}]{6}$`);

test('the order-number example uses the real format in every language', async () => {
  for (const lang of ['en', 'fr', 'ar']) {
    const messages = (await load(`i18n/${lang}.ts`))[lang];
    const example = messages.contact.waOrderNumberPh.match(/BRX-[A-Z0-9-]+/)?.[0];
    assert.ok(example && realNumber.test(example), `${lang}: "${messages.contact.waOrderNumberPh}" is not like a real order number`);
  }
});

test('"Track my order" on the Contact page sends guests to the Track order page', () => {
  const contact = fs.readFileSync(path.join(src, 'pages/store/Contact.tsx'), 'utf8');
  assert.match(contact, /to: signedIn \? '\/account\/orders' : '\/track-order', label: t\('contact\.trackOrder'\)/);
});
