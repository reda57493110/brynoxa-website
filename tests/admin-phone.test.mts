// Admin on phones: a table wider than a phone screen (600px or more) must come with a phone layout
// in the same file (cards / list shown with `sm:hidden`, the table from `sm:` up), so staff never
// have to scroll sideways. Print-only pages are skipped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dirs = ['frontend/src/pages/admin', 'frontend/src/components/admin'].map((d) => path.join(root, d));
const PRINT_ONLY = new Set(['ProfitReport.tsx', 'DeliverySlips.tsx']);

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? files(full) : e.name.endsWith('.tsx') ? [full] : [];
  });
}

test('wide admin tables have a phone layout', () => {
  const wide = /min-w-\[(\d+)px\]/g;
  let checked = 0;
  for (const f of dirs.flatMap(files)) {
    if (PRINT_ONLY.has(path.basename(f))) continue;
    const text = fs.readFileSync(f, 'utf8');
    if (!text.includes('<table') && !text.includes('<Table')) continue;
    const widest = Math.max(0, ...[...text.matchAll(wide)].map((m) => Number(m[1])));
    if (widest < 600) continue;
    checked++;
    assert.match(text, /\b(sm|md|lg):hidden\b/, `${path.relative(root, f)}: a ${widest}px table with no phone layout`);
  }
  assert.ok(checked >= 10, 'the wide admin tables were found');
});
