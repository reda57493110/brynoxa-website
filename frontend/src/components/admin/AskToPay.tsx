import { useEffect, useMemo, useState } from 'react'
import { useDepositMethods } from '@/hooks/useDepositMethods'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { depositSteps } from '@/lib/depositSteps'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Locale } from '@/i18n'
import type { Order } from '@/types'

const LANGS: { id: Locale; label: string }[] = [
  { id: 'fr', label: 'Français' },
  { id: 'ar', label: 'العربية' },
  { id: 'en', label: 'English' },
]

const TEXT: Record<Locale, { hello: (n: string) => string; intro: (o: string, a: string) => string; rest: (r: string) => string; thanks: string }> = {
  fr: {
    hello: (n) => `Bonjour ${n},`,
    intro: (o, a) => `Pour confirmer votre commande ${o}, merci de payer un acompte de ${a}.`,
    rest: (r) => `Le reste (${r}) se paie à la livraison.`,
    thanks: 'Merci — Brynoxa',
  },
  ar: {
    hello: (n) => `مرحبا ${n}،`,
    intro: (o, a) => `لتأكيد طلبك ${o}، المرجو دفع عربون بقيمة ${a}.`,
    rest: (r) => `الباقي (${r}) يُدفع عند التسليم.`,
    thanks: 'شكرا — Brynoxa',
  },
  en: {
    hello: (n) => `Hello ${n},`,
    intro: (o, a) => `To confirm your order ${o}, please pay a deposit of ${a}.`,
    rest: (r) => `The rest (${r}) is paid on delivery.`,
    thanks: 'Thank you — Brynoxa',
  },
}

/** Moroccan phone → WhatsApp number (06… → 2126…). */
function whatsappNumber(phone?: string) {
  let d = (phone || '').replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.startsWith('0')) d = `212${d.slice(1)}`
  else if (d.length === 9) d = `212${d}`
  return d.length >= 11 ? d : ''
}

/**
 * Admin: the ready message asking the customer to pay the deposit — their name, the amount and
 * the steps of the chosen payment option — sent on WhatsApp or copied.
 */
export function AskToPay({ order }: { order: Order }) {
  const all = useDepositMethods()
  const shared = order.deposit?.methodIds ?? []
  const methods = useMemo(
    () => (all.data?.depositMethods ?? []).filter((m) => m.visible !== false && (!shared.length || shared.includes(m.id))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all.data?.depositMethods, shared.join()]
  )
  const [methodId, setMethodId] = useState('')
  const [lang, setLang] = useState<Locale>('fr')
  const [text, setText] = useState('')
  const [copied, setCopied] = useState(false)

  const method = methods.find((m) => m.id === methodId) ?? methods[0]
  const customer = order.shippingAddress?.fullName || ''
  const amount = order.deposit?.amount ?? 0
  const rest = Math.max(0, order.pricing.total - amount)

  // Rebuild the message when the option or the language changes (staff can still edit it)
  useEffect(() => {
    if (!method) return
    const tx = TEXT[lang]
    const steps = depositSteps(method, { customer, amount: formatCurrency(amount), order: order.orderNumber }, lang)
    setText(
      [
        tx.hello(customer.split(' ')[0] || customer),
        tx.intro(order.orderNumber, formatCurrency(amount)),
        '',
        `${method.name || method.type}:`,
        ...steps.map((s, i) => `${i + 1}. ${s}`),
        '',
        tx.rest(formatCurrency(rest)),
        tx.thanks,
      ].join('\n')
    )
  }, [method, lang, customer, amount, rest, order.orderNumber])

  if (!methods.length) {
    return (
      <p className="text-xs text-[var(--fg-muted)]">
        Add your payment options (RIB, Cash Plus…) in Orders → Deposits & payments to send ready messages.
      </p>
    )
  }

  const wa = whatsappNumber(order.shippingAddress?.phone)
  const chip = (active: boolean) =>
    cn(
      'h-8 rounded-full border px-3 text-xs font-medium transition',
      active ? 'border-transparent bg-[var(--brand)] text-[var(--brand-fg)]' : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--brand)]'
    )

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {methods.map((m) => (
          <button key={m.id} type="button" className={chip(method?.id === m.id)} onClick={() => setMethodId(m.id)}>
            {m.name || m.type}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-[var(--border)]" aria-hidden="true" />
        {LANGS.map((l) => (
          <button key={l.id} type="button" className={chip(lang === l.id)} onClick={() => setLang(l.id)}>
            {l.label}
          </button>
        ))}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={9}
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        aria-label="Message to the customer"
        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 text-sm leading-relaxed outline-none ring-brand"
      />
      <div className="flex flex-wrap gap-2">
        {wa ? (
          <a
            href={`https://wa.me/${wa}?text=${encodeURIComponent(text)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#25D366] px-4 text-sm font-semibold text-white hover:brightness-105"
          >
            <SiteIcon name="chat" size={14} /> WhatsApp {order.shippingAddress?.phone}
          </a>
        ) : null}
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            } catch {
              /* clipboard blocked */
            }
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--border)] px-4 text-sm font-medium hover:border-[var(--brand)]"
        >
          <SiteIcon name={copied ? 'check' : 'layers'} size={14} /> {copied ? 'Copied' : 'Copy message'}
        </button>
      </div>
    </div>
  )
}
