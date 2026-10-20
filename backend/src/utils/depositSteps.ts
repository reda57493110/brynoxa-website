import type { DepositMethod } from '../models/Settings';

/**
 * Step-by-step "how to pay the deposit" for one payment option, with the customer's name, the
 * amount, the receiver and the order filled in (English, for emails). Staff can write their own
 * steps; otherwise these defaults are used. Mirrored in frontend/src/lib/depositSteps.ts.
 *
 * Placeholders: {customer} {amount} {receiver} {account} {method} {order}
 */

const BANK = [
  'Make a bank transfer of {amount} to {receiver}.',
  'RIB: {account}',
  'Write your order number {order} as the transfer reason.',
  'Send us the receipt with “Send proof of payment” on your order page.',
].join('\n');

const AGENCY = [
  'Go to a {method} agency (or use the {method} app).',
  'Send {amount} to {receiver} — phone {account}.',
  'Sender name: {customer}.',
  'Keep the receipt and the transfer code, then send them with “Send proof of payment” on your order page.',
].join('\n');

const ATM = [
  'In your bank app or at your bank\'s ATM, choose “Send money / Cardless withdrawal”.',
  'Send {amount} to {receiver} — phone {account}.',
  'You receive the withdrawal codes by SMS.',
  'Send us the codes with “Send proof of payment” on your order page.',
].join('\n');

const OTHER = ['Send {amount} to {receiver} ({account}).', 'Reason: order {order}.', 'Send us the receipt with “Send proof of payment”.'].join('\n');

const TYPE_NAMES: Record<string, string> = {
  bank: 'Bank',
  cashplus: 'Cash Plus',
  wafacash: 'Wafacash',
  barid: 'Barid Cash',
  atm: 'ATM',
  other: 'Other',
};

export function defaultSteps(type: string) {
  return type === 'bank' ? BANK : type === 'atm' ? ATM : ['cashplus', 'wafacash', 'barid'].includes(type) ? AGENCY : OTHER;
}

export function depositSteps(
  method: Pick<DepositMethod, 'type' | 'name' | 'holder' | 'account'> & { steps?: string },
  values: { customer: string; amount: string; order: string }
): string[] {
  const template = method.steps?.trim() || defaultSteps(method.type);
  const vars: Record<string, string> = {
    customer: values.customer || '—',
    amount: values.amount,
    order: values.order,
    receiver: method.holder || method.name || TYPE_NAMES[method.type] || 'us',
    account: method.account || '—',
    method: method.name || TYPE_NAMES[method.type] || 'Other',
  };
  return template
    .split('\n')
    .map((line) => line.replace(/\{(customer|amount|order|receiver|account|method)\}/g, (_, k: string) => vars[k]).trim())
    .filter(Boolean);
}
