import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { ordersApi } from '@/api/ordersApi'
import { productsApi } from '@/api/productsApi'
import { getErrorMessage } from '@/api/client'
import { Container } from '@/components/ui/Container'
import { Badge } from '@/components/ui/Badge'
import { DepositNotice } from '@/components/order/DepositNotice'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { SafeImage } from '@/components/ui/SafeImage'
import { optimizedImageUrl } from '@/lib/image'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { AccountHeader } from '@/components/layout/AccountHeader'
import { surfaceCard } from '@/components/layout/pageStyles'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { toast } from '@/store/toastStore'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useT } from '@/hooks/useT'
import { orderStatusKey } from '@/i18n'
import { formatDeliveryDay, orderStatusVariant } from '@/lib/orderStatus'
import type { OrderItem, Product, ProductCondition } from '@/types'
import { ConditionBadge } from '@/components/product/ConditionBadge'
import { OrderProgress } from '@/components/order/OrderProgress'



function productIdOf(item: OrderItem) {
  return typeof item.product === 'string' ? item.product : item.product._id
}

type DraftItem = {
  productId: string
  name: string
  image?: string
  price: number
  qty: number
  sku: string
  condition?: ProductCondition
}

function toDraft(items: OrderItem[]): DraftItem[] {
  return items.map((item) => ({
    productId: productIdOf(item),
    name: item.name,
    image: item.image,
    price: item.price,
    qty: item.qty,
    sku: item.sku,
    condition: item.condition,
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
  const [editing, setEditing] = useState(false)
  usePageTitle(orderNumber ? t('orders.titleOne', { number: orderNumber }) : t('orders.titleGeneric'))

  const order = useQuery({
    queryKey: ['order', orderNumber],
    // Always fresh when opened (new orders, deposit updates)
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => (await ordersApi.getByNumber(orderNumber)).data.data,
    enabled: Boolean(orderNumber),
  })

  useEffect(() => {
    if (order.data) setDraft(toDraft(order.data.items))
  }, [order.data])

  // Once the deposit is received, changes and cancellations go through the shop
  const canEdit =
    order.data?.orderStatus === 'pending' && order.data.deposit?.status !== 'received'

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
      setEditing(false)
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
          condition: product.condition,
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

  if (order.isError) {
    return (
      <Container className="py-8 sm:py-10">
        <QueryErrorState
          title={t('orders.loadError')}
          description={t('orders.loadErrorBody')}
          onRetry={() => order.refetch()}
        />
      </Container>
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
      <AccountHeader
        title={`#${o.orderNumber}`}
        back={{ to: '/account/orders', label: t('orders.backToOrders') }}
        meta={
          <>
            <Badge variant={orderStatusVariant(o.orderStatus)}>{t(orderStatusKey(o.orderStatus))}</Badge>
            <span className="text-xs text-[var(--fg-muted)] sm:text-sm">{formatDateTime(o.createdAt)}</span>
            {o.orderStatus === 'rescheduled' && o.rescheduledFor ? (
              <span className="text-sm font-medium">{t('orders.rescheduledFor', { date: formatDeliveryDay(o.rescheduledFor) })}</span>
            ) : null}
          </>
        }
      />
      <Container className="pt-4 pb-8 sm:pt-5 sm:pb-10">
        <DepositNotice order={o} className="mb-4" canReport />

        <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
          <div className="space-y-4 lg:col-span-2">
            {/* Products: compact list; changes only while the order is pending */}
            <section className={`${surfaceCard} p-3 sm:p-4`}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="font-display text-sm font-semibold sm:text-base">
                  {t('orders.itemCount', { count: draft.reduce((n, i) => n + i.qty, 0) })}
                </h2>
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (editing) setDraft(toDraft(o.items))
                      setEditing((v) => !v)
                    }}
                    className="text-xs font-medium text-[var(--brand-text)] hover:underline"
                  >
                    {editing ? t('orders.cancelEdit') : t('orders.editItems')}
                  </button>
                ) : null}
              </div>
              <ul className="divide-y divide-[var(--border)]">
                {draft.map((item) => (
                  <li key={item.productId} className="flex items-center gap-3 py-2.5">
                    {item.image ? (
                      <SafeImage src={optimizedImageUrl(item.image, 160)} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-muted)]">
                        <SiteIcon name="package" size={16} className="text-[var(--fg-muted)]" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium leading-snug">{item.name}</p>
                      {editing ? (
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="inline-flex items-center rounded-full border border-[var(--border)]">
                            <button
                              type="button"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-[var(--bg-muted)]"
                              onClick={() => setQty(item.productId, Math.max(1, item.qty - 1))}
                              aria-label={t('orders.decreaseQty')}
                            >
                              <SiteIcon name="minus" size={12} />
                            </button>
                            <span className="min-w-6 text-center text-xs font-semibold tabular-nums">{item.qty}</span>
                            <button
                              type="button"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-[var(--bg-muted)]"
                              onClick={() => setQty(item.productId, Math.min(99, item.qty + 1))}
                              aria-label={t('orders.increaseQty')}
                            >
                              <SiteIcon name="plus" size={12} />
                            </button>
                          </div>
                          <button
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--fg-muted)] hover:text-[var(--danger)]"
                            onClick={() => removeItem(item.productId)}
                            aria-label={t('orders.removeProduct')}
                          >
                            <SiteIcon name="trash" size={13} />
                          </button>
                        </div>
                      ) : (
                        <p className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--fg-muted)]">
                          <span className="tabular-nums">
                            {item.qty} × {formatCurrency(item.price)}
                          </span>
                          <ConditionBadge condition={item.condition} size="sm" />
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums">{formatCurrency(item.price * item.qty)}</p>
                  </li>
                ))}
              </ul>
              {editing ? (
                <div className="mt-2 flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
                  <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => setAddOpen(true)}>
                    <SiteIcon name="plus" size={14} />
                    {t('orders.addProduct')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-full"
                    disabled={!dirty}
                    loading={saveItems.isPending}
                    onClick={() => saveItems.mutate()}
                  >
                    {t('orders.saveChanges')}
                  </Button>
                </div>
              ) : null}
            </section>

            {/* Progress: 4 steps + latest update; full history folded */}
            <section className={`${surfaceCard} p-3 sm:p-4`}>
              <h2 className="font-display text-sm font-semibold sm:text-base">{t('orders.tracking')}</h2>
              <OrderProgress status={o.orderStatus} timeline={o.timeline} className="mt-3" />
            </section>
          </div>

          {/* Summary + delivery in one card */}
          <aside className={`${surfaceCard} h-fit p-3 text-sm sm:p-4`}>
            <h2 className="font-display text-sm font-semibold sm:text-base">{t('orders.summary')}</h2>
            <dl className="mt-2 space-y-1.5">
              <div className="flex justify-between">
                <dt className="text-[var(--fg-muted)]">{t('orders.subtotal')}</dt>
                <dd className="tabular-nums">{formatCurrency(dirty ? previewTotal : o.pricing.subtotal)}</dd>
              </div>
              {!dirty && o.pricing.discount > 0 ? (
                <div className="flex justify-between">
                  <dt className="text-[var(--fg-muted)]">{t('orders.discount')}</dt>
                  <dd className="tabular-nums text-[var(--success)]">-{formatCurrency(o.pricing.discount)}</dd>
                </div>
              ) : null}
              {!dirty ? (
                <div className="flex justify-between">
                  <dt className="text-[var(--fg-muted)]">{t('checkout.shipping')}</dt>
                  <dd className="tabular-nums">{o.pricing.shipping > 0 ? formatCurrency(o.pricing.shipping) : t('checkout.free')}</dd>
                </div>
              ) : null}
              {!dirty && o.pricing.tax > 0 ? (
                <div className="flex justify-between">
                  <dt className="text-[var(--fg-muted)]">{t('orders.tax')}</dt>
                  <dd className="tabular-nums">{formatCurrency(o.pricing.tax)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-[var(--border)] pt-2 font-semibold">
                <dt>{t('orders.totalCod')}</dt>
                <dd className="tabular-nums">{formatCurrency(dirty ? previewTotal : o.pricing.total)}</dd>
              </div>
            </dl>
            {dirty ? <p className="mt-2 text-xs text-[var(--fg-muted)]">{t('orders.saveToConfirm')}</p> : null}

            <div className="mt-3 border-t border-[var(--border)] pt-3">
              <p className="text-xs font-medium text-[var(--fg-muted)]">{t('orders.shippingHeading')}</p>
              <p className="mt-1 font-medium">{o.shippingAddress.fullName}</p>
              <p className="text-xs leading-relaxed text-[var(--fg-muted)]">
                {o.shippingAddress.line1}, {o.shippingAddress.city}
                <br />
                <span dir="ltr">{o.shippingAddress.phone}</span>
              </p>
            </div>

            {canEdit ? (
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="mt-3 text-xs font-medium text-[var(--danger)] hover:underline"
              >
                {t('orders.cancel')}
              </button>
            ) : null}
          </aside>
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
                    <SafeImage src={optimizedImageUrl(image, 240)} alt="" className="h-14 w-14 rounded-xl object-cover" />
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
