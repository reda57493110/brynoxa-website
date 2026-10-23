import { useDeferredValue, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { Panel } from '@/components/admin/Panel'
import { OrderItemThumb } from '@/components/admin/OrderThumbs'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { SocialGlyph } from '@/components/contact/BrandIcons'
import { Spinner } from '@/components/ui/Spinner'
import { formatCurrency } from '@/lib/format'
import { MANUAL_ORDER_ORIGINS, ORDER_ORIGIN_LABEL, type OrderOrigin } from '@/lib/orderOrigin'
import { cn } from '@/lib/cn'
import { toast } from '@/store/toastStore'
import type { Product } from '@/types'

type Line = { product: Product; qty: number; price: string }
type StartStatus = 'pending' | 'confirmed' | 'delivered'

const STATUSES: { id: StartStatus; title: string; body: string }[] = [
  { id: 'pending', title: 'New — to confirm', body: 'Like a website order: confirm it later' },
  { id: 'confirmed', title: 'Confirmed', body: 'Agreed with the customer; stock is reserved' },
  { id: 'delivered', title: 'Sold & paid', body: 'Already handed over and paid (e.g. in the shop)' },
]

const ORIGIN_ICON: Record<Exclude<OrderOrigin, 'website'>, Parameters<typeof SiteIcon>[0]['name']> = {
  facebook: 'chat',
  instagram: 'chat',
  whatsapp: 'chat',
  tiktok: 'chat',
  phone: 'phone',
  store: 'home',
  other: 'tag',
}

/** "1 200,50" / "1200.5" → 1200.5; empty → undefined; anything else → NaN. */
function amount(v: string): number | undefined {
  const s = v.replace(/\s/g, '').replace(',', '.')
  if (!s) return undefined
  return /^\d+(\.\d{1,2})?$/.test(s) ? Number(s) : NaN
}

const productImage = (p: Product) => (p.images?.find((i) => i.isPrimary) || p.images?.[0])?.url

/**
 * Admin → Orders → New order: a sale from Facebook, Instagram, WhatsApp, a phone call or the shop.
 * It becomes a normal order: same stock, profit, delivery slip and history as a website order.
 */
export function NewOrder() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [origin, setOrigin] = useState<Exclude<OrderOrigin, 'website'>>('instagram')
  const [status, setStatus] = useState<StartStatus>('pending')
  const [lines, setLines] = useState<Line[]>([])
  const [query, setQuery] = useState('')
  const q = useDeferredValue(query.trim())
  const [customer, setCustomer] = useState({ fullName: '', phone: '', email: '', city: '', line1: '' })
  const [shipping, setShipping] = useState('')
  const [discount, setDiscount] = useState('')
  const [deliveryCost, setDeliveryCost] = useState('')
  const [note, setNote] = useState('')
  const [tried, setTried] = useState(false)

  const results = useQuery({
    queryKey: ['admin-products', 'new-order-search', q],
    queryFn: async () => (await adminApi.products.list({ q, limit: 8 })).data.data,
    enabled: q.length >= 2,
  })

  const inStore = origin === 'store'
  const unitPrice = (l: Line) => amount(l.price) ?? l.product.price
  const subtotal = lines.reduce((a, l) => a + (Number.isFinite(unitPrice(l)) ? unitPrice(l) : 0) * l.qty, 0)
  const discountN = Math.min(amount(discount) ?? 0, subtotal)
  const shippingN = amount(shipping) ?? 0
  const total = Math.max(0, subtotal - (Number.isFinite(discountN) ? discountN : 0)) + (Number.isFinite(shippingN) ? shippingN : 0)

  const errors = {
    lines: !lines.length ? 'Add at least one product' : undefined,
    fullName: customer.fullName.trim().length < 2 ? 'Enter the customer name' : undefined,
    phone: customer.phone.replace(/\D/g, '').length < 8 ? 'Enter a phone number' : undefined,
    city: !inStore && customer.city.trim().length < 2 ? 'Enter the city' : undefined,
    email: customer.email.trim() && !/^\S+@\S+\.\S+$/.test(customer.email.trim()) ? 'Check the email' : undefined,
    money: [shipping, discount, deliveryCost, ...lines.map((l) => l.price)].some((v) => Number.isNaN(amount(v)))
      ? 'Amounts: numbers only, e.g. 1500 or 35.50'
      : undefined,
    stock: lines.find((l) => l.qty > l.product.stock)?.product.name,
  }
  const invalid = Object.values(errors).some(Boolean)

  const create = useMutation({
    mutationFn: () =>
      adminApi.orders.create({
        origin,
        status,
        items: lines.map((l) => ({ productId: l.product._id, qty: l.qty, price: amount(l.price) })),
        customer: {
          fullName: customer.fullName.trim(),
          phone: customer.phone.trim(),
          email: customer.email.trim() || undefined,
          city: customer.city.trim() || (inStore ? 'Shop' : ''),
          line1: customer.line1.trim() || undefined,
        },
        shipping: amount(shipping) ?? 0,
        discount: amount(discount) ?? 0,
        deliveryCost: amount(deliveryCost),
        adminNote: note.trim() || undefined,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin-orders'] })
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] })
      qc.invalidateQueries({ queryKey: ['admin-inventory'] })
      qc.invalidateQueries({ queryKey: ['admin-products'] })
      toast.success(`Order #${res.data.data.orderNumber} added`)
      navigate(`/admin/orders/${res.data.data._id}`)
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const addProduct = (p: Product) => {
    setLines((prev) =>
      prev.some((l) => l.product._id === p._id)
        ? prev.map((l) => (l.product._id === p._id ? { ...l, qty: Math.min(99, l.qty + 1) } : l))
        : [...prev, { product: p, qty: 1, price: '' }]
    )
    setQuery('')
  }
  const setLine = (id: string, patch: Partial<Line>) => setLines((prev) => prev.map((l) => (l.product._id === id ? { ...l, ...patch } : l)))
  const field = (k: keyof typeof customer) => ({
    value: customer[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setCustomer((c) => ({ ...c, [k]: e.target.value })),
  })

  const pickedIds = new Set(lines.map((l) => l.product._id))
  const options = (results.data ?? []).filter((p) => !pickedIds.has(p._id))

  return (
    <div className="min-w-0 space-y-4">
      <Link to="/admin/orders" className="inline-flex items-center gap-1 text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]">
        <SiteIcon name="chevron-left" size={14} className="rtl:rotate-180" /> Orders
      </Link>
      <AdminHeader
        title="New order"
        description="A sale from Facebook, Instagram, WhatsApp, a call or the shop. It is counted in stock, orders and profit like a website order. The customer gets no message."
      />

      <Panel title="Where did this order come from?">
        <div className="flex flex-wrap gap-2">
          {MANUAL_ORDER_ORIGINS.map((o) => (
            <button
              key={o}
              type="button"
              aria-pressed={origin === o}
              onClick={() => {
                setOrigin(o)
                if (o === 'store') setStatus('delivered')
              }}
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition',
                origin === o
                  ? 'border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-fg)]'
                  : 'border-[var(--border)] hover:border-[var(--brand)] hover:text-[var(--brand-text)]'
              )}
            >
              {o === 'facebook' || o === 'instagram' || o === 'whatsapp' ? <SocialGlyph id={o} size={14} /> : <SiteIcon name={ORIGIN_ICON[o]} size={14} />}{' '}
              {ORDER_ORIGIN_LABEL[o]}
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Products" description="Search by name or SKU. Change the price if you agreed another one with the customer.">
        <div className="relative">
          <SiteIcon name="search" size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a product…"
            aria-label="Find a product"
            className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-input)] ps-9 pe-3 text-sm outline-none ring-brand"
          />
          {q.length >= 2 ? (
            <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-soft-lg">
              {results.isFetching && !results.data ? (
                <div className="flex justify-center py-4">
                  <Spinner />
                </div>
              ) : options.length ? (
                <ul className="max-h-72 divide-y divide-[var(--border)] overflow-y-auto">
                  {options.map((p) => (
                    <li key={p._id}>
                      <button
                        type="button"
                        onClick={() => addProduct(p)}
                        disabled={p.stock <= 0}
                        className="flex w-full items-center gap-3 px-3 py-2 text-start hover:bg-[var(--bg-muted)] disabled:opacity-50"
                      >
                        <OrderItemThumb item={{ image: productImage(p), name: p.name }} size="sm" className="h-9 w-9" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {p.name}
                            {p.variantLabel ? ` (${p.variantLabel})` : ''}
                          </span>
                          <span className="block text-xs text-[var(--fg-muted)]">
                            {p.sku} · {p.stock > 0 ? `${p.stock} in stock` : 'out of stock'}
                            {!p.isActive ? ' · hidden in the shop' : ''}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">{formatCurrency(p.price)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-3 py-3 text-sm text-[var(--fg-muted)]">No product found.</p>
              )}
            </div>
          ) : null}
        </div>

        {lines.length ? (
          <ul className="mt-3 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
            {lines.map((l) => (
              <li key={l.product._id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
                <OrderItemThumb item={{ image: productImage(l.product), name: l.product.name }} size="sm" className="h-10 w-10" />
                <div className="min-w-0 flex-1 basis-40">
                  <p className="truncate text-sm font-medium">{l.product.name}</p>
                  <p className={cn('text-xs', l.qty > l.product.stock ? 'text-[var(--danger)]' : 'text-[var(--fg-muted)]')}>
                    {l.product.stock} in stock · shop price {formatCurrency(l.product.price)}
                  </p>
                </div>
                <label className="flex items-center gap-1.5 text-xs text-[var(--fg-muted)]">
                  Qty
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={l.qty}
                    onChange={(e) => setLine(l.product._id, { qty: Math.max(1, Math.min(99, Number(e.target.value) || 1)) })}
                    className="h-9 w-16 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-2 text-sm text-[var(--fg)]"
                  />
                </label>
                <label className="flex items-center gap-1.5 text-xs text-[var(--fg-muted)]">
                  Price
                  <input
                    inputMode="decimal"
                    value={l.price}
                    placeholder={String(l.product.price)}
                    onChange={(e) => setLine(l.product._id, { price: e.target.value })}
                    className="h-9 w-24 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-2 text-sm text-[var(--fg)]"
                  />
                </label>
                <span className="w-24 text-end text-sm font-semibold tabular-nums">
                  {Number.isFinite(unitPrice(l)) ? formatCurrency(unitPrice(l) * l.qty) : '—'}
                </span>
                <button
                  type="button"
                  onClick={() => setLines((prev) => prev.filter((x) => x.product._id !== l.product._id))}
                  aria-label={`Remove ${l.product.name}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:text-[var(--danger)]"
                >
                  <SiteIcon name="trash" size={14} />
                </button>
              </li>
            ))}
          </ul>
        ) : tried && errors.lines ? (
          <p className="mt-2 text-xs text-[var(--danger)]">{errors.lines}</p>
        ) : null}
        {errors.stock ? <p className="mt-2 text-xs text-[var(--danger)]">Not enough stock for {errors.stock}.</p> : null}
      </Panel>

      <Panel title="Customer" description="If this phone or email already bought from you, the order is added to that customer.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Name" {...field('fullName')} maxLength={100} error={tried ? errors.fullName : undefined} />
          <Input label="Phone" type="tel" {...field('phone')} maxLength={30} error={tried ? errors.phone : undefined} />
          <Input label={inStore ? 'City (optional)' : 'City'} {...field('city')} maxLength={80} error={tried ? errors.city : undefined} />
          <Input label="Address (optional)" {...field('line1')} maxLength={200} />
          <Input label="Email (optional)" type="email" {...field('email')} maxLength={160} error={tried ? errors.email : undefined} />
        </div>
      </Panel>

      <Panel title="Status and money">
        <div className="grid gap-2 sm:grid-cols-3">
          {STATUSES.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={status === s.id}
              onClick={() => setStatus(s.id)}
              className={cn(
                'rounded-xl border px-3 py-2.5 text-start transition',
                status === s.id
                  ? 'border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_10%,transparent)]'
                  : 'border-[var(--border)] hover:border-[var(--brand)]'
              )}
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                {status === s.id ? <SiteIcon name="check" size={14} className="text-[var(--brand-text)]" /> : null}
                {s.title}
              </span>
              <span className="mt-0.5 block text-xs text-[var(--fg-muted)]">{s.body}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Input label="Delivery paid by the customer (DH)" inputMode="decimal" value={shipping} onChange={(e) => setShipping(e.target.value)} placeholder="0" />
          <Input label="Discount (DH)" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
          <Input
            label="Courier cost for you (DH)"
            inputMode="decimal"
            value={deliveryCost}
            onChange={(e) => setDeliveryCost(e.target.value)}
            placeholder={inStore ? '0' : 'Default price'}
          />
        </div>
        <label className="mt-3 flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Internal note (optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={2000}
            rows={2}
            placeholder="e.g. Instagram DM from @username"
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-3.5 py-2.5 text-sm outline-none ring-brand"
          />
        </label>
        {tried && errors.money ? <p className="mt-2 text-xs text-[var(--danger)]">{errors.money}</p> : null}
      </Panel>

      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 shadow-soft-lg">
        <div className="text-sm">
          <span className="text-[var(--fg-muted)]">Total </span>
          <span className="font-display text-lg font-semibold tabular-nums">{formatCurrency(total)}</span>
          <span className="ms-2 text-xs text-[var(--fg-muted)]">
            {ORDER_ORIGIN_LABEL[origin]} · {STATUSES.find((s) => s.id === status)?.title}
          </span>
        </div>
        <Button
          type="button"
          loading={create.isPending}
          onClick={() => {
            setTried(true)
            if (!invalid) create.mutate()
            else toast.error('Check the highlighted fields')
          }}
        >
          <SiteIcon name="check" size={14} /> Add order
        </Button>
      </div>
    </div>
  )
}
