import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ordersApi } from '@/api/ordersApi'
import { getErrorMessage } from '@/api/client'
import { Container } from '@/components/ui/Container'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { SafeImage } from '@/components/ui/SafeImage'
import { optimizedImageUrl } from '@/lib/image'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { PageHero } from '@/components/layout/PageHero'
import { surfaceCard } from '@/components/layout/pageStyles'
import { formatCurrency, formatDate } from '@/lib/format'
import { toast } from '@/store/toastStore'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useT } from '@/hooks/useT'
import { orderStatusKey } from '@/i18n'
import type { Order } from '@/types'

function statusVariant(status: string) {
  if (status === 'delivered') return 'success' as const
  if (status === 'cancelled') return 'danger' as const
  if (status === 'shipped') return 'brand' as const
  if (status === 'confirmed' || status === 'processing') return 'success' as const
  return 'warning' as const
}

export function Orders() {
  const t = useT()
  usePageTitle(t('orders.title'))
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null)

  const orders = useQuery({
    queryKey: ['orders'],
    queryFn: async () => (await ordersApi.list({ limit: 50 })).data.data,
  })

  const cancel = useMutation({
    mutationFn: (orderNumber: string) => ordersApi.cancel(orderNumber),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] })
      setCancelTarget(null)
      toast.success(t('orders.cancelled'))
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const toggle = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <>
      <PageHero
        kicker={t('orders.kicker')}
        title={t('orders.heading')}
        description={t('orders.listBody')}
      >
        <Link to="/account" className="text-sm font-medium text-[var(--brand-text)] hover:underline">
          {t('orders.backToAccount')}
        </Link>
      </PageHero>
      <Container className="py-8 sm:py-10">
        {orders.isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : orders.isError ? (
          <QueryErrorState
            title={t('orders.loadError')}
            description={t('orders.loadErrorBody')}
            onRetry={() => orders.refetch()}
          />
        ) : !orders.data?.length ? (
          <EmptyState
            icon="package"
            title={t('orders.emptyTitle')}
            description={t('orders.emptyBody')}
            actionLabel={t('orders.startShopping')}
            onAction={() => navigate('/shop')}
          />
        ) : (
          <div className="space-y-3">
            {orders.data.map((order) => {
              const open = Boolean(expanded[order._id])
              const pending = order.orderStatus === 'pending'
              return (
                <div key={order._id} className={`${surfaceCard} overflow-hidden`}>
                  <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-display font-semibold">#{order.orderNumber}</p>
                      <p className="mt-1 text-sm text-[var(--fg-muted)]">{formatDate(order.createdAt)}</p>
                      <div className="mt-3 flex items-center gap-2">
                        {order.items.slice(0, 4).map((item, i) =>
                          item.image ? (
                            <SafeImage
                              key={`${item.sku}-${i}`}
                              src={optimizedImageUrl(item.image, 240)}
                              alt=""
                              className="h-10 w-10 rounded-xl object-cover"
                            />
                          ) : (
                            <span
                              key={`${item.sku}-${i}`}
                              className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--bg-muted)]"
                            >
                              <SiteIcon name="package" size={14} className="text-[var(--fg-muted)]" />
                            </span>
                          )
                        )}
                        {order.items.length > 4 ? (
                          <span className="text-xs font-medium text-[var(--fg-muted)]">
                            +{order.items.length - 4}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-xs text-[var(--fg-muted)]">
                        {t('orders.itemCount', { count: order.items.length })}
                      </p>
                    </div>

                    <div className="flex flex-col items-stretch gap-3 sm:items-end">
                      <div className="flex items-center gap-3">
                        <Badge variant={statusVariant(order.orderStatus)}>
                          {t(orderStatusKey(order.orderStatus))}
                        </Badge>
                        <span className="font-display font-semibold">
                          {formatCurrency(order.pricing.total)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => toggle(order._id)}
                        >
                          <SiteIcon name={open ? 'chevron' : 'chevron-down'} size={14} />
                          {open ? t('orders.hideProducts') : t('orders.viewProducts')}
                        </Button>
                        <Link
                          to={`/account/orders/${order.orderNumber}`}
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-3 text-sm font-semibold text-[var(--brand-fg)] shadow-glow transition hover:brightness-110"
                        >
                          {pending ? t('orders.manageOrder') : t('orders.openOrder')}
                        </Link>
                        {pending ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="danger"
                            onClick={() => setCancelTarget(order)}
                          >
                            {t('orders.cancel')}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {open ? (
                    <div className="border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-muted)_45%,transparent)] px-5 py-4">
                      <ul className="space-y-3">
                        {order.items.map((item, i) => (
                          <li key={`${item.sku}-${i}`} className="flex items-center gap-3">
                            {item.image ? (
                              <SafeImage src={optimizedImageUrl(item.image, 240)} alt="" className="h-12 w-12 rounded-xl object-cover" />
                            ) : (
                              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--bg-elevated)]">
                                <SiteIcon name="package" size={16} />
                              </span>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{item.name}</p>
                              <p className="text-xs text-[var(--fg-muted)]">
                                {t('orders.qty', { qty: item.qty })} · {formatCurrency(item.price)}
                              </p>
                            </div>
                            <span className="text-sm font-semibold">
                              {formatCurrency(item.price * item.qty)}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {pending ? (
                        <p className="mt-3 text-xs text-[var(--fg-muted)]">{t('orders.pendingEditHint')}</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </Container>

      <Modal
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        title={t('orders.cancelTitle')}
        size="sm"
      >
        <p className="text-sm leading-relaxed text-[var(--fg-muted)]">{t('orders.cancelBody')}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={() => setCancelTarget(null)}>
            {t('orders.keepOrder')}
          </Button>
          <Button
            variant="danger"
            type="button"
            loading={cancel.isPending}
            onClick={() => cancelTarget && cancel.mutate(cancelTarget.orderNumber)}
          >
            {t('orders.cancel')}
          </Button>
        </div>
      </Modal>
    </>
  )
}
