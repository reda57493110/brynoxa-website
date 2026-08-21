import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { ordersApi } from '@/api/ordersApi'
import { productsApi } from '@/api/productsApi'
import { getErrorMessage } from '@/api/client'
import { Container } from '@/components/ui/Container'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { PageHero } from '@/components/layout/PageHero'
import { surfaceCard } from '@/components/layout/pageStyles'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { toast } from '@/store/toastStore'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useT } from '@/hooks/useT'
import { orderStatusKey } from '@/i18n'
import type { OrderItem, Product } from '@/types'

function statusVariant(status: string) {
  if (status === 'delivered') return 'success' as const
  if (status === 'cancelled') return 'danger' as const
  if (status === 'shipped') return 'brand' as const
  if (status === 'confirmed' || status === 'processing') return 'success' as const
  return 'warning' as const
}

function productIdOf(item: OrderItem) {
  return typeof item.product === 'string' ? item.product : item.product._id
}

type DraftItem = { productId: string; name: string; image?: string; price: number; qty: number; sku: string }

function toDraft(items: OrderItem[]): DraftItem[] {
  return items.map((item) => ({
    productId: productIdOf(item),
    name: item.name,
    image: item.image,
    price: item.price,
    qty: item.qty,
    sku: item.sku,
  }))
}

export function OrderDetail() {
  const t = useT()
  const { orderNumber = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<DraftItem[]>([])
  usePageTitle(orderNumber ? t('orders.titleOne', { number: orderNumber }) : t('orders.titleGeneric'))

  const order = useQuery({
    queryKey: ['order', orderNumber],
    queryFn: async () => (await ordersApi.getByNumber(orderNumber)).data.data,
    enabled: Boolean(orderNumber),
  })

  useEffect(() => {
    if (order.data) setDraft(toDraft(order.data.items))
  }, [order.data])

  const canEdit = order.data?.orderStatus === 'pending'

  const dirty = useMemo(() => {
    if (!order.data || !canEdit) return false
    const original = toDraft(order.data.items)
    if (original.length !== draft.length) return true
    const qtyById = new Map(original.map((item) => [item.productId, item.qty]))
    return draft.some((item) => qtyById.get(item.productId) !== item.qty)
  }, [order.data, draft, canEdit])

  const catalog = useQuery({
    queryKey: ['order-add-products', search],
    queryFn: async () =>
      (await productsApi.list({ q: search || undefined, limit: 12, sort: 'newest' })).data.data,
    enabled: addOpen,
  })

  const cancel = useMutation({
    mutationFn: () => ordersApi.cancel(orderNumber),
    onSuccess: (res) => {
      queryClient.setQueryData(['order', orderNumber], res.data.data)
      void queryClient.invalidateQueries({ queryKey: ['orders'] })
      setConfirmOpen(false)
      toast.success(t('orders.cancelled'))
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const saveItems = useMutation({
    mutationFn: () =>
      ordersApi.updateItems(
        orderNumber,
        draft.map((item) => ({ productId: item.productId, qty: item.qty }))
      ),
    onSuccess: (res) => {
      queryClient.setQueryData(['order', orderNumber], res.data.data)
      void queryClient.invalidateQueries({ queryKey: ['orders'] })
      setDraft(toDraft(res.data.data.items))
      toast.success(t('orders.updated'))
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const setQty = (productId: string, qty: number) => {
    setDraft((prev) =>
      prev
        .map((item) => (item.productId === productId ? { ...item, qty } : item))
        .filter((item) => item.qty > 0)
    )
  }

  const removeItem = (productId: string) => {
    if (draft.length <= 1) {
      toast.error(t('orders.keepOneProduct'))
      return
    }
    setDraft((prev) => prev.filter((item) => item.productId !== productId))
  }

  const addProduct = (product: Product) => {
    setDraft((prev) => {
      const existing = prev.find((item) => item.productId === product._id)
      if (existing) {
        return prev.map((item) =>
          item.productId === product._id ? { ...item, qty: Math.min(99, item.qty + 1) } : item
        )
      }
      const image = product.images?.find((img) => img.isPrimary)?.url || product.images?.[0]?.url
      return [
        ...prev,
        {
          productId: product._id,
          name: product.name,
          image,
          price: product.price,
          qty: 1,
          sku: product.sku,
        },
      ]
    })
    setAddOpen(false)
    setSearch('')
    toast.success(t('orders.productAdded'))
  }

  if (order.isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!order.data) {
    return (
      <Container className="py-8 sm:py-10">
        <EmptyState
          title={t('orders.notFound')}
          description={t('orders.notFoundBody')}
          actionLabel={t('orders.backToOrders')}
          onAction={() => navigate('/account/orders')}
        />
      </Container>
    )
  }

  const o = order.data
  const previewTotal = draft.reduce((sum, item) => sum + item.price * item.qty, 0)

  return (
    <>
      <PageHero
        kicker={t('orders.heroKicker')}
        title={`#${o.orderNumber}`}
        description={t('orders.placedPay', { date: formatDateTime(o.createdAt) })}
      >
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={statusVariant(o.orderStatus)}>{t(orderStatusKey(o.orderStatus))}</Badge>
          <Link
            to="/account/orders"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand-text)] hover:underline"
          >
            <SiteIcon name="arrow-left" size={16} />
            {t('orders.allOrders')}
          </Link>
          {canEdit ? (
            <Button variant="danger" size="sm" type="button" onClick={() => setConfirmOpen(true)}>
              {t('orders.cancel')}
            </Button>
          ) : null}
        </div>
      </PageHero>
      <Container className="py-8 sm:py-10">
        {canEdit ? (
          <p className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-muted)] px-4 py-3 text-sm text-[var(--fg)]">
            {t('orders.editHint')}
          </p>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            {draft.map((item) => (
              <div key={item.productId} className={`${surfaceCard} flex gap-4 p-4`}>
                {item.image ? (
                  <img src={item.image} alt="" className="h-20 w-20 rounded-2xl object-cover" />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--bg-muted)]">
                    <SiteIcon name="package" size={22} className="text-[var(--fg-muted)]" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-display font-semibold">{item.name}</p>
                  <p className="text-sm text-[var(--fg-muted)]">{formatCurrency(item.price)}</p>
                  {canEdit ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <div className="inline-flex items-center rounded-full border border-[var(--border)]">
                        <button
                          type="button"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-[var(--bg-muted)]"
                          onClick={() => setQty(item.productId, Math.max(1, item.qty - 1))}
                          aria-label={t('orders.decreaseQty')}
                        >
                          <SiteIcon name="minus" size={14} />
                        </button>
                        <span className="min-w-8 text-center text-sm font-semibold tabular-nums">{item.qty}</span>
                        <button
                          type="button"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-[var(--bg-muted)]"
                          onClick={() => setQty(item.productId, Math.min(99, item.qty + 1))}
                          aria-label={t('orders.increaseQty')}
                        >
                          <SiteIcon name="plus" size={14} />
                        </button>
                      </div>
                      <button
                        type="button"
                        className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)]"
                        onClick={() => removeItem(item.productId)}
                      >
                        <SiteIcon name="trash" size={14} />
                        {t('orders.removeProduct')}
                      </button>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-[var(--fg-muted)]">{t('orders.qty', { qty: item.qty })}</p>
                  )}
                </div>
                <p className="font-semibold">{formatCurrency(item.price * item.qty)}</p>
              </div>
            ))}

            {canEdit ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="rounded-full" onClick={() => setAddOpen(true)}>
                  <SiteIcon name="plus" size={16} />
                  {t('orders.addProduct')}
                </Button>
                <Button
                  type="button"
                  className="rounded-full"
                  disabled={!dirty}
                  loading={saveItems.isPending}
                  onClick={() => saveItems.mutate()}
                >
                  {t('orders.saveChanges')}
                </Button>
              </div>
            ) : null}

            <div className={`${surfaceCard} p-6`}>
              <h2 className="font-display text-lg font-semibold">{t('orders.tracking')}</h2>
              <ol className="mt-4 space-y-4">
                {o.timeline.map((entry, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--brand)]" />
                    <div>
                      <p className="font-medium capitalize">{t(orderStatusKey(entry.status))}</p>
                      {entry.note ? <p className="text-sm text-[var(--fg-muted)]">{entry.note}</p> : null}
                      <p className="text-xs text-[var(--fg-muted)]">{formatDateTime(entry.at)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="space-y-4">
            <div className={`${surfaceCard} p-6`}>
              <h2 className="font-display font-semibold">{t('orders.summary')}</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-[var(--fg-muted)]">{t('orders.subtotal')}</dt>
                  <dd>{formatCurrency(dirty ? previewTotal : o.pricing.subtotal)}</dd>
                </div>
                {!dirty && o.pricing.discount > 0 ? (
                  <div className="flex justify-between">
                    <dt className="text-[var(--fg-muted)]">{t('orders.discount')}</dt>
                    <dd>-{formatCurrency(o.pricing.discount)}</dd>
                  </div>
                ) : null}
                {!dirty && o.pricing.tax > 0 ? (
                  <div className="flex justify-between">
                    <dt className="text-[var(--fg-muted)]">{t('orders.tax')}</dt>
                    <dd>{formatCurrency(o.pricing.tax)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between border-t border-[var(--border)] pt-2 font-semibold">
                  <dt>{t('orders.totalCod')}</dt>
                  <dd>{formatCurrency(dirty ? previewTotal : o.pricing.total)}</dd>
                </div>
              </dl>
              {dirty ? (
                <p className="mt-3 text-xs text-[var(--fg-muted)]">{t('orders.saveToConfirm')}</p>
              ) : null}
            </div>

            <div className={`${surfaceCard} p-6 text-sm`}>
              <h2 className="font-display font-semibold">{t('orders.shippingHeading')}</h2>
              <p className="mt-2 font-medium">{o.shippingAddress.fullName}</p>
              <p className="mt-1 text-[var(--fg-muted)]">
                {o.shippingAddress.line1}
                <br />
                {o.shippingAddress.city}, {t('ui.morocco')}
                <br />
                {o.shippingAddress.phone}
              </p>
            </div>
          </div>
        </div>
      </Container>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title={t('orders.cancelTitle')} size="sm">
        <p className="text-sm leading-relaxed text-[var(--fg-muted)]">{t('orders.cancelBody')}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={() => setConfirmOpen(false)}>
            {t('orders.keepOrder')}
          </Button>
          <Button variant="danger" type="button" loading={cancel.isPending} onClick={() => cancel.mutate()}>
            {t('orders.cancel')}
          </Button>
        </div>
      </Modal>

      <Modal
        open={addOpen}
        onClose={() => {
          setAddOpen(false)
          setSearch('')
        }}
        title={t('orders.addProduct')}
        size="lg"
      >
        <Input
          label={t('common.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('common.searchPlaceholder')}
        />
        <div className="mt-4 max-h-[55vh] space-y-2 overflow-y-auto">
          {catalog.isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : !catalog.data?.length ? (
            <p className="py-8 text-center text-sm text-[var(--fg-muted)]">{t('orders.noProductsFound')}</p>
          ) : (
            catalog.data.map((product) => {
              const image =
                product.images?.find((img) => img.isPrimary)?.url || product.images?.[0]?.url
              const already = draft.some((item) => item.productId === product._id)
              return (
                <div
                  key={product._id}
                  className="flex items-center gap-3 rounded-2xl border border-[var(--border)] p-3"
                >
                  {image ? (
                    <img src={image} alt="" className="h-14 w-14 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--bg-muted)]">
                      <SiteIcon name="package" size={18} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{product.name}</p>
                    <p className="text-sm text-[var(--fg-muted)]">{formatCurrency(product.price)}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={already ? 'secondary' : 'primary'}
                    disabled={product.stock < 1}
                    onClick={() => addProduct(product)}
                  >
                    {already ? t('orders.addAnother') : t('orders.add')}
                  </Button>
                </div>
              )
            })
          )}
        </div>
      </Modal>
    </>
  )
}
