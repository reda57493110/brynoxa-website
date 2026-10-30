// Phone notifications: every order step the customer is told about in the site (except "order
// placed", shown at once) also has a phone message, in English, French and Arabic; received
// returns send one too. The phone's language follows the shop's (PushPrompt → syncPushLocale).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./_helpers.cjs');

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

test('every notified order step has a phone message in the three languages', () => {
  const site = read('backend/src/services/orderNotify.service.ts');
  const steps = [...site.matchAll(/^  (\w+): \{\n\s+title: '/gm)].map((m) => m[1]).filter((s) => s !== 'pending');
  assert.ok(steps.length >= 10, steps.join(','));
  const push = read('backend/src/services/push.service.ts');
  const copy = push.slice(push.indexOf('const ORDER_STATUS_COPY'), push.indexOf('export async function notifyCustomerOrderStatus'));
  for (const step of steps) {
    const block = copy.match(new RegExp(`\\n  ${step}: \\{([\\s\\S]*?)\\n  \\},`));
    assert.ok(block, `phone message for ${step}`);
    for (const lang of ['en', 'fr', 'ar']) {
      assert.match(block[1], new RegExp(`\\n    ${lang}: \\{ title: '[^']+', body: '[^']*\\{n\\}`), `${step} ${lang}`);
    }
  }
});

test('received returns notify the phone; the phone language follows the shop', () => {
  assert.match(read('backend/src/services/inventoryOps.service.ts'), /await notifyCustomerOrderStatus\(result\.order, result\.next/);
  assert.match(read('frontend/src/components/push/PushPrompt.tsx'), /void syncPushLocale\(locale\)/);
  assert.match(read('frontend/src/store/localeStore.ts'), /locale: currentPathLocale\(\)/);
});
