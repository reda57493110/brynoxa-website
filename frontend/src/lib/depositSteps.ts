import type { Locale } from '@/i18n'
import type { DepositMethod, DepositMethodType } from '@/types'

/**
 * Step-by-step "how to pay the deposit" for each payment option, with the customer's name, the
 * amount, the receiver and the order filled in. Staff can write their own steps (Admin → Orders →
 * Deposits & payments); otherwise these defaults are used. Mirrored in backend/src/utils/depositSteps.ts
 * (English, for emails).
 *
 * Placeholders: {customer} {amount} {receiver} {account} {method} {order}
 */
export const STEP_PLACEHOLDERS = ['{customer}', '{amount}', '{receiver}', '{account}', '{method}', '{order}'] as const

type Templates = Record<'bank' | 'agency' | 'other', string>

const DEFAULTS: Record<Locale, Templates> = {
  en: {
    bank: [
      'Make a bank transfer of {amount} to {receiver}.',
      'RIB: {account}',
      'Write your order number {order} as the transfer reason.',
      'Send us the receipt with “I have paid”.',
    ].join('\n'),
    agency: [
      'Go to a {method} agency (or use the {method} app).',
      'Send {amount} to {receiver} — phone {account}.',
      'Sender name: {customer}.',
      'Keep the receipt and the transfer code, then send them with “I have paid”.',
    ].join('\n'),
    other: ['Send {amount} to {receiver} ({account}).', 'Reason: order {order}.', 'Send us the receipt with “I have paid”.'].join('\n'),
  },
  fr: {
    bank: [
      'Faites un virement de {amount} à {receiver}.',
      'RIB : {account}',
      'Indiquez votre numéro de commande {order} comme motif.',
      'Envoyez-nous le reçu avec « J’ai payé ».',
    ].join('\n'),
    agency: [
      'Rendez-vous dans une agence {method} (ou utilisez l’application {method}).',
      'Envoyez {amount} à {receiver} — téléphone {account}.',
      'Nom de l’expéditeur : {customer}.',
      'Gardez le reçu et le code du transfert, puis envoyez-les avec « J’ai payé ».',
    ].join('\n'),
    other: ['Envoyez {amount} à {receiver} ({account}).', 'Motif : commande {order}.', 'Envoyez-nous le reçu avec « J’ai payé ».'].join('\n'),
  },
  ar: {
    bank: [
      'قم بتحويل بنكي بمبلغ {amount} إلى {receiver}.',
      'RIB: {account}',
      'اكتب رقم طلبك {order} كسبب للتحويل.',
      'أرسل لنا الوصل عبر «لقد دفعت».',
    ].join('\n'),
    agency: [
      'توجه إلى وكالة {method} (أو استعمل تطبيق {method}).',
      'أرسل {amount} إلى {receiver} — الهاتف {account}.',
      'اسم المرسل: {customer}.',
      'احتفظ بالوصل ورمز التحويل، ثم أرسلهما عبر «لقد دفعت».',
    ].join('\n'),
    other: ['أرسل {amount} إلى {receiver} ({account}).', 'السبب: الطلب {order}.', 'أرسل لنا الوصل عبر «لقد دفعت».'].join('\n'),
  },
}

const AGENCY_TYPES: DepositMethodType[] = ['cashplus', 'wafacash', 'barid']

const TYPE_NAMES: Record<DepositMethodType, string> = {
  bank: 'Bank',
  cashplus: 'Cash Plus',
  wafacash: 'Wafacash',
  barid: 'Barid Cash',
  other: 'Other',
}

/** The built-in steps for a payment type (what the admin starts from). */
export function defaultSteps(type: DepositMethodType, locale: Locale = 'en') {
  const t = DEFAULTS[locale] ?? DEFAULTS.en
  return type === 'bank' ? t.bank : AGENCY_TYPES.includes(type) ? t.agency : t.other
}

export interface StepValues {
  customer: string
  amount: string
  order: string
}

/** The steps of one payment option, ready to show: placeholders replaced, one line per step. */
export function depositSteps(method: DepositMethod, values: StepValues, locale: Locale = 'en'): string[] {
  const template = method.steps?.trim() || defaultSteps(method.type, locale)
  const vars: Record<string, string> = {
    customer: values.customer || '—',
    amount: values.amount,
    order: values.order,
    receiver: method.holder || method.name || TYPE_NAMES[method.type],
    account: method.account || '—',
    method: method.name || TYPE_NAMES[method.type],
  }
  return template
    .split('\n')
    .map((line) => line.replace(/\{(customer|amount|order|receiver|account|method)\}/g, (_, k: string) => vars[k]).trim())
    .filter(Boolean)
}
