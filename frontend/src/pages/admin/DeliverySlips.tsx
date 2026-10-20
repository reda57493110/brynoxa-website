import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { CONTACT } from '@/lib/site'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { feesCovered, toCollect } from '@/lib/deposit'
import { cn } from '@/lib/cn'
import type { Order } from '@/types'

type Lang = 'fr' | 'ar' | 'en'

/** Customer copy texts (the shop copy stays in English like the rest of admin). */
const T: Record<Lang, Record<string, string>> = {
  fr: {
    copy: 'Exemplaire client',
    shopCopy: "Exemplaire boutique",
    slip: 'Bon de livraison',
    order: 'Commande',
    deliverTo: 'Livré à',
    item: 'Article',
    qty: 'Qté',
    price: 'Prix',
    subtotal: 'Sous-total',
    shipping: 'Livraison',
    free: 'Offerte',
    discount: 'Remise',
    total: 'Total',
    deposit: 'Acompte payé',
    fees: 'Frais de transfert pris en charge',
    toPay: 'À payer au livreur',
    paid: 'Déjà payé',
    warrantyTitle: 'Garantie 6 mois',
    warranty: 'Gardez ce bon : il sert de preuve d’achat pour la garantie et les retours (14 jours).',
    track: 'Suivre votre commande',
    help: 'Une question ? WhatsApp',
    thanks: 'Merci pour votre confiance !',
    items: 'articles',
  },
  ar: {
    copy: 'نسخة الزبون',
    shopCopy: "نسخة المتجر",
    slip: 'وصل التسليم',
    order: 'الطلب',
    deliverTo: 'التسليم إلى',
    item: 'المنتج',
    qty: 'الكمية',
    price: 'الثمن',
    subtotal: 'المجموع الفرعي',
    shipping: 'التوصيل',
    free: 'مجاني',
    discount: 'تخفيض',
    total: 'المجموع',
    deposit: 'العربون المدفوع',
    fees: 'رسوم التحويل على حسابنا',
    toPay: 'المبلغ للدفع لموظف التوصيل',
    paid: 'تم الدفع',
    warrantyTitle: 'ضمان 6 أشهر',
    warranty: 'احتفظ بهذا الوصل: هو إثبات الشراء للضمان والإرجاع (14 يوما).',
    track: 'تتبع طلبك',
    help: 'سؤال؟ واتساب',
    thanks: 'شكرا لثقتكم!',
    items: 'منتجات',
  },
  en: {
    copy: 'Customer copy',
    shopCopy: "Shop copy",
    slip: 'Delivery slip',
    order: 'Order',
    deliverTo: 'Deliver to',
    item: 'Item',
    qty: 'Qty',
    price: 'Price',
    subtotal: 'Subtotal',
    shipping: 'Shipping',
    free: 'Free',
    discount: 'Discount',
    total: 'Total',
    deposit: 'Deposit paid',
    fees: 'Transfer fees covered',
    toPay: 'To pay the courier',
    paid: 'Already paid',
    warrantyTitle: '6-month warranty',
    warranty: 'Keep this slip: it is your proof of purchase for the warranty and returns (14 days).',
    track: 'Track your order',
    help: 'Questions? WhatsApp',
    thanks: 'Thank you for your trust!',
    items: 'items',
  },
}

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <img src="/brand/brynoxa-mark.png" alt="" className="h-8 w-8 rounded-md bg-[#080B0E]" />
      <div className="leading-tight">
        <p className="text-base font-bold tracking-tight">Brynoxa</p>
        <p className="text-[9px] text-black/60" dir="ltr">
          {CONTACT.phone.value} · {CONTACT.email.value}
        </p>
      </div>
    </div>
  )
}

function Money({ order: o, labels, strongLabel }: { order: Order; labels: Record<string, string>; strongLabel: string }) {
  const depositPaid = o.deposit?.status === 'received' ? o.deposit.amount : 0
  const fees = depositPaid ? feesCovered(o) : 0
  const row = (label: string, value: string, cls = '') => (
    <div className={cn('flex justify-between gap-3', cls)}>
      <dt>{label}</dt>
      <dd className="shrink-0 whitespace-nowrap tabular-nums" dir="ltr">
        {value}
      </dd>
    </div>
  )
  return (
    <dl className="space-y-0.5 text-[11px]">
      {row(labels.subtotal, formatCurrency(o.pricing.subtotal))}
      {o.pricing.discount ? row(labels.discount, `−${formatCurrency(o.pricing.discount)}`) : null}
      {row(labels.shipping, o.pricing.shipping ? formatCurrency(o.pricing.shipping) : labels.free)}
      {row(labels.total, formatCurrency(o.pricing.total), 'font-semibold')}
      {depositPaid ? row(labels.deposit, `−${formatCurrency(depositPaid)}`) : null}
      {fees ? row(labels.fees, `−${formatCurrency(fees)}`) : null}
      <div className="mt-1 flex items-center justify-between gap-3 rounded-md bg-black px-2 py-1.5 text-white">
        <dt className="text-[11px] font-bold">{strongLabel}</dt>
        <dd className="text-base font-extrabold tabular-nums" dir="ltr">
          {formatCurrency(toCollect(o))}
        </dd>
      </div>
    </dl>
  )
}

function Items({ order: o, labels, sku = false }: { order: Order; labels: Record<string, string>; sku?: boolean }) {
  return (
    <table className="w-full border-collapse text-[11px]">
      <thead>
        <tr className="border-b border-black/40 text-start text-[9px] uppercase tracking-wide text-black/60">
          <th className="py-1 text-start font-semibold">{labels.item}</th>
          <th className="w-10 py-1 text-center font-semibold">{labels.qty}</th>
          <th className="w-24 py-1 text-end font-semibold">{labels.price}</th>
        </tr>
      </thead>
      <tbody>
        {o.items.map((i, idx) => (
          <tr key={idx} className="border-b border-black/10 align-top">
            <td className="py-1 pe-2">
              <span className="font-medium">{i.name}</span>
              {sku ? <span className="block text-[9px] text-black/60">{i.sku}</span> : null}
            </td>
            <td className="py-1 text-center font-bold">{i.qty}</td>
            <td className="py-1 text-end tabular-nums" dir="ltr">
              {formatCurrency(i.price * i.qty)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Address({ order: o, title }: { order: Order; title: string }) {
  const a = o.shippingAddress
  return (
    <div>
      <p className="text-[9px] font-semibold uppercase tracking-wide text-black/60">{title}</p>
      <p className="text-[13px] font-bold">{a?.fullName}</p>
      <p className="text-[12px] font-semibold" dir="ltr">
        {a?.phone}
      </p>
      <p className="text-[11px]">
        {a?.line1}
        {a?.line2 ? `, ${a.line2}` : ''}
      </p>
      <p className="text-[11px] font-semibold uppercase">{a?.city}</p>
    </div>
  )
}

/** Top half: what the customer keeps (proof of purchase, what to pay, warranty, help). */
function CustomerCopy({ order: o, lang, forShop = false }: { order: Order; lang: Lang; forShop?: boolean }) {
  const t = T[lang]
  const count = o.items.reduce((n, i) => n + i.qty, 0)
  const trackUrl = `${window.location.origin}/track-order`
  return (
    <section dir={lang === 'ar' ? 'rtl' : 'ltr'} className="flex h-full flex-col gap-2.5">
      <header className="flex items-start justify-between gap-3 border-b-2 border-black pb-2">
        <Brand />
        <div className="text-end">
          <p className="inline-block rounded bg-black px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">{forShop ? t.shopCopy : t.copy}</p>
          <p className="mt-1 text-[10px] uppercase tracking-wide text-black/60">{t.slip}</p>
          <p className="text-sm font-extrabold" dir="ltr">
            #{o.orderNumber}
          </p>
          <p className="text-[10px] text-black/70" dir="ltr">
            {formatDateTime(o.createdAt)}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-[1fr_auto] gap-4">
        <Address order={o} title={t.deliverTo} />
        <div className="w-60">
          <Money order={o} labels={t} strongLabel={t.toPay} />
        </div>
      </div>

      <div>
        <Items order={o} labels={t} />
        <p className="mt-1 text-[10px] text-black/60">
          {count} {t.items}
        </p>
      </div>

      <div className="mt-auto grid grid-cols-2 gap-3 border-t border-black/20 pt-2 text-[10px] leading-snug">
        <div>
          <p className="font-bold">✓ {t.warrantyTitle}</p>
          <p className="text-black/70">{t.warranty}</p>
        </div>
        <div className="text-end">
          <p className="font-bold">{t.track}</p>
          <p className="text-black/70" dir="ltr">
            {trackUrl.replace(/^https?:\/\//, '')} · #{o.orderNumber}
          </p>
          <p className="mt-0.5 text-black/70">
            {t.help} <span dir="ltr">{CONTACT.whatsapp.value}</span>
          </p>
        </div>
      </div>
      <p className="text-center text-[11px] font-semibold">{t.thanks}</p>
    </section>
  )
}

/** One order: one copy on its own A5 page, or the same slip twice on an A4 sheet (cut line between). */
function Sheet({ order, lang, copies }: { order: Order; lang: Lang; copies: 1 | 2 }) {
  if (copies === 1) {
    return (
      <article className="sheet mx-auto w-full max-w-[148mm] bg-white text-black shadow-sm print:shadow-none">
        <div className="h-[210mm] overflow-hidden p-[8mm] print:p-[7mm]">
          <CustomerCopy order={order} lang={lang} />
        </div>
      </article>
    )
  }
  return (
    <article className="sheet mx-auto flex w-full max-w-[210mm] flex-col bg-white text-black shadow-sm print:shadow-none">
      <div className="h-[143mm] overflow-hidden p-[8mm] print:p-[7mm]">
        <CustomerCopy order={order} lang={lang} />
      </div>
      <div className="relative border-t-2 border-dashed border-black/50">
        <span className="absolute -top-2.5 start-3 bg-white px-1 text-[10px] text-black/60">✂</span>
      </div>
      <div className="h-[143mm] overflow-hidden p-[8mm] print:p-[7mm]">
        <CustomerCopy order={order} lang={lang} forShop />
      </div>
    </article>
  )
}

/**
 * Printable delivery slips for the orders in `?ids=`: one copy per order (A5), or two identical
 * copies on an A4 sheet — one for the customer, one for the shop. Opened from Orders (bulk) or an order's page; prints automatically once loaded.
 */
export function DeliverySlips() {
  const [params] = useSearchParams()
  const ids = (params.get('ids') || '').split(',').filter((id) => /^[a-f0-9]{24}$/i.test(id)).slice(0, 50)
  const [lang, setLang] = useState<Lang>(() => {
    try {
      const saved = localStorage.getItem('brynoxa-slip-lang')
      return saved === 'ar' || saved === 'en' ? saved : 'fr'
    } catch {
      return 'fr'
    }
  })

  const [copies, setCopies] = useState<1 | 2>(() => {
    try {
      return localStorage.getItem('brynoxa-slip-copies') === '2' ? 2 : 1
    } catch {
      return 1
    }
  })
  const pickCopies = (n: 1 | 2) => {
    setCopies(n)
    try {
      localStorage.setItem('brynoxa-slip-copies', String(n))
    } catch {
      /* private mode */
    }
  }

  const orders = useQuery({
    queryKey: ['admin-order-slips', ids],
    queryFn: async () => Promise.all(ids.map(async (id) => (await adminApi.orders.get(id)).data.data)),
    enabled: ids.length > 0,
  })

  useEffect(() => {
    if (!orders.data?.length) return
    const id = window.setTimeout(() => window.print(), 500)
    return () => window.clearTimeout(id)
  }, [orders.data])

  const pickLang = (l: Lang) => {
    setLang(l)
    try {
      localStorage.setItem('brynoxa-slip-lang', l)
    } catch {
      /* private mode */
    }
  }

  return (
    <div className="min-h-dvh bg-[var(--bg-muted)] p-4 print:bg-white print:p-0">
      <style>{copies === 1
        ? '@page { size: A5; margin: 0 } @media print { .sheet { break-after: page; height: 210mm } .sheet:last-child { break-after: auto } }'
        : '@page { size: A4; margin: 0 } @media print { .sheet { break-after: page; height: 297mm } .sheet:last-child { break-after: auto } }'}</style>
      <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-2 print:hidden">
        <Link to="/admin/orders" className="text-sm text-[var(--brand-text)] hover:underline">
          ← Back to orders
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[var(--fg-muted)]">Copies</span>
          {([1, 2] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => pickCopies(n)}
              className={cn(
                'h-8 w-9 rounded-full border text-xs font-medium',
                copies === n ? 'border-transparent bg-[var(--brand)] text-[var(--brand-fg)]' : 'border-[var(--border)] text-[var(--fg-muted)]'
              )}
            >
              {n}
            </button>
          ))}
          <span className="ms-2 text-xs text-[var(--fg-muted)]">Language</span>
          {(['fr', 'ar', 'en'] as Lang[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => pickLang(l)}
              className={cn(
                'h-8 rounded-full border px-3 text-xs font-medium',
                lang === l ? 'border-transparent bg-[var(--brand)] text-[var(--brand-fg)]' : 'border-[var(--border)] text-[var(--fg-muted)]'
              )}
            >
              {l === 'fr' ? 'Français' : l === 'ar' ? 'العربية' : 'English'}
            </button>
          ))}
          <Button size="sm" onClick={() => window.print()} disabled={!orders.data?.length}>
            Print {ids.length > 1 ? `${ids.length} sheets` : 'sheet'}
          </Button>
        </div>
      </div>
      {!ids.length ? (
        <p className="text-center text-sm text-[var(--fg-muted)]">No orders selected.</p>
      ) : orders.isPending ? (
        <div className="flex justify-center py-24">
          <Spinner size="lg" />
        </div>
      ) : orders.isError ? (
        <QueryErrorState onRetry={() => orders.refetch()} />
      ) : (
        <div className="space-y-4 print:space-y-0">
          {orders.data.map((o) => (
            <Sheet key={o._id} order={o} lang={lang} copies={copies} />
          ))}
        </div>
      )}
    </div>
  )
}
