// Analytics never receives sign-in / reset / verification keys from the address.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const { safePath } = await import(pathToFileURL(path.join(root, 'frontend/src/lib/safePath.ts')).href);

test('reset and verify keys are removed; normal filters stay', () => {
  assert.equal(safePath('/reset-password?token=abc123'), '/reset-password');
  assert.equal(safePath('/verify-email?token=abc&lang=fr'), '/verify-email?lang=fr');
  assert.equal(safePath('/shop?category=laptops&q=hp'), '/shop?category=laptops&q=hp');
  assert.equal(safePath('/fr/shop'), '/fr/shop');
});
