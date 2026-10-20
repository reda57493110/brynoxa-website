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

type Templates = Record<'bank' | 'agency' | 'atm' | 'other', string>

const DEFAULTS: Record<Locale, Templates> = {
  en: {
    bank: [
      'Make a bank transfer of {amount} to {receiver}.',
      'RIB: {account}',
      'Write your order number {order} as the transfer reason.',
      'Send us the receipt with “Send proof of payment”.',
    ].join('\n'),
    agency: [
      'Go to a {method} agency (or use the {method} app).',
      'Send {amount} to {receiver} — phone {account}.',
      'Sender name: {customer}.',
      'Keep the receipt and the transfer code, then send them with “Send proof of payment”.',
    ].join('\n'),
    atm: [
      'In your bank app or at your bank’s ATM, choose “Send money / Cardless withdrawal”.',
      'Send {amount} to {receiver} — phone {account}.',
      'You receive the withdrawal codes by SMS.',
      'Send us the codes with “Send proof of payment”.',
    ].join('\n'),
    other: ['Send {amount} to {receiver} ({account}).', 'Reason: order {order}.', 'Send us the receipt with “Send proof of payment”.'].join('\n'),
  },
  fr: {
    bank: [
      'Faites un virement de {amount} à {receiver}.',
      'RIB : {account}',
      'Indiquez votre numéro de commande {order} comme motif.',
      'Envoyez-nous le reçu avec « Envoyer la preuve de paiement ».',
    ].join('\n'),
    agency: [
      'Rendez-vous dans une agence {method} (ou utilisez l’application {method}).',
      'Envoyez {amount} à {receiver} — téléphone {account}.',
      'Nom de l’expéditeur : {customer}.',
      'Gardez le reçu et le code du transfert, puis envoyez-les avec « Envoyer la preuve de paiement ».',
    ].join('\n'),
    atm: [
      'Dans l’application de votre banque ou au GAB, choisissez « Envoi d’argent / Retrait sans carte ».',
      'Envoyez {amount} à {receiver} — téléphone {account}.',
      'Vous recevez les codes de retrait par SMS.',
      'Envoyez-nous les codes avec « Envoyer la preuve de paiement ».',
    ].join('\n'),
    other: ['Envoyez {amount} à {receiver} ({account}).', 'Motif : commande {order}.', 'Envoyez-nous le reçu avec « Envoyer la preuve de paiement ».'].join('\n'),
  },
  ar: {
    bank: [
      'قم بتحويل بنكي بمبلغ {amount} إلى {receiver}.',
      'RIB: {account}',
      'اكتب رقم طلبك {order} كسبب للتحويل.',
      'أرسل لنا الوصل عبر «إرسال إثبات الدفع».',
    ].join('\n'),
    agency: [
      'توجه إلى وكالة {method} (أو استعمل تطبيق {method}).',
      'أرسل {amount} إلى {receiver} — الهاتف {account}.',
      'اسم المرسل: {customer}.',
      'احتفظ بالوصل ورمز التحويل، ثم أرسلهما عبر «إرسال إثبات الدفع».',
    ].join('\n'),
    atm: [
      'في تطبيق بنكك أو في الشباك الأوتوماتيكي، اختر «إرسال المال / سحب بدون بطاقة».',
      'أرسل {amount} إلى {receiver} — الهاتف {account}.',
      'ستتوصل برموز السحب عبر رسالة SMS.',
      'أرسل لنا الرموز عبر «إرسال إثبات الدفع».',
    ].join('\n'),
    other: ['أرسل {amount} إلى {receiver} ({account}).', 'السبب: الطلب {order}.', 'أرسل لنا الوصل عبر «إرسال إثبات الدفع».'].join('\n'),
  },
}

export const AGENCY_TYPES: DepositMethodType[] = ['cashplus', 'wafacash', 'barid']

/** ATM cardless withdrawal: the codes asked for unless staff set their own (same as the backend). */
export const DEFAULT_ATM_CODES = ['Withdrawal code (red)', 'Second code (green)', 'PIN (4 digits)']

const TYPE_NAMES: Record<DepositMethodType, string> = {
  bank: 'Bank',
  cashplus: 'Cash Plus',
  wafacash: 'Wafacash',
  barid: 'Barid Cash',
  atm: 'ATM',
  other: 'Other',
}

/** The built-in steps for a payment type (what the admin starts from). */
export function defaultSteps(type: DepositMethodType, locale: Locale = 'en') {
  const t = DEFAULTS[locale] ?? DEFAULTS.en
  return type === 'bank' ? t.bank : type === 'atm' ? t.atm : AGENCY_TYPES.includes(type) ? t.agency : t.other
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
