// Customers → Export: an Excel file that opens as a real table (bold header kept in view, filter
// arrows, DH amounts, real dates and numbers), a printable list (PDF), and CSV for other software.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { dist, ROOT, setTestEnv } = require('./_helpers.cjs');
setTestEnv();

const { buildXlsx } = require(dist('utils/xlsx.js'));

/** The files inside a stored (uncompressed) zip. */
function unzip(buf) {
  const files = {};
  let i = 0;
  while (buf.readUInt32LE(i) === 0x04034b50) {
    const size = buf.readUInt32LE(i + 18);
    const nameLen = buf.readUInt16LE(i + 26);
    const name = buf.slice(i + 30, i + 30 + nameLen).toString('utf8');
    files[name] = buf.slice(i + 30 + nameLen, i + 30 + nameLen + size).toString('utf8');
    i += 30 + nameLen + size;
  }
  return files;
}

test('the Excel file: a real table with bold header, filters, DH amounts, dates and numbers', () => {
  const columns = [
    { header: 'Name', width: 24 },
    { header: 'Registered', type: 'date' },
    { header: 'Orders', type: 'number' },
    { header: 'Amount paid', type: 'money' },
    { header: 'Margin', type: 'percent' },
  ];
  const file = buildXlsx('Customers', columns, [
    ['Reda', '2026-10-18', 1, 3800, 12.5],
    ['رضا & <Co> "x"', null, 0, 0, null],
  ]);
  assert.equal(file.slice(0, 2).toString(), 'PK');
  const f = unzip(file);
  assert.deepEqual(Object.keys(f).sort(), ['[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml']);
  const sheet = f['xl/worksheets/sheet1.xml'];
  assert.match(sheet, /<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"\/>/, 'header stays in view');
  assert.match(sheet, /<autoFilter ref="A1:E3"\/>/, 'filter arrows');
  assert.match(sheet, /<c r="A1" t="inlineStr" s="1">/, 'bold header style');
  assert.match(sheet, /<c r="B2" s="5"><v>46313<\/v><\/c>/, '2026-10-18 as a real date');
  assert.match(sheet, /<c r="C2" s="2"><v>1<\/v><\/c>/, 'a real number');
  assert.match(sheet, /<c r="D2" s="3"><v>3800<\/v><\/c>/, 'an amount in DH');
  assert.match(sheet, /<c r="E2" s="4"><v>0.125<\/v><\/c>/, '12.5 %');
  assert.match(sheet, /رضا &amp; &lt;Co&gt; &quot;x&quot;/, 'any text kept safely');
  assert.match(f['xl/styles.xml'], /#,##0.00 &quot;DH&quot;/);
  // Every part is well-formed enough to have its root closed
  for (const [name, text] of Object.entries(f)) assert.match(text.trim(), /<\/[A-Za-z:]+>$/, name);
});

test('export: Excel by default, a table for the printable list, CSV on request; a menu in the admin', () => {
  const ctl = fs.readFileSync(path.join(ROOT, 'backend/src/controllers/customer.controller.ts'), 'utf8');
  assert.match(ctl, /if \(req\.query\.format === 'json'\)/);
  assert.match(ctl, /if \(req\.query\.format === 'csv'\)/);
  assert.match(ctl, /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/);
  const svc = fs.readFileSync(path.join(ROOT, 'backend/src/services/customerAnalytics.service.ts'), 'utf8');
  assert.match(svc, /unverified: 'Email not confirmed'/, 'readable words, not codes');
  const page = fs.readFileSync(path.join(ROOT, 'frontend/src/pages/admin/Customers.tsx'), 'utf8');
  for (const choice of ['Excel file (.xlsx)', 'PDF / print', 'CSV']) assert.ok(page.includes(`title: '${choice}'`), choice);
  assert.match(fs.readFileSync(path.join(ROOT, 'frontend/src/app/router.tsx'), 'utf8'), /path="admin-print\/customers"/);
  assert.match(fs.readFileSync(path.join(ROOT, 'frontend/src/pages/admin/CustomersPrint.tsx'), 'utf8'), /size: A4 landscape/);
});
