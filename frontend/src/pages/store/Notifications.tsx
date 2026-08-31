import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { notificationsApi } from '@/api/notificationsApi'
import { Container } from '@/components/ui/Container'
import { PageHero } from '@/components/layout/PageHero'
import { EmptyState } from '@/components/ui/EmptyState'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useT } from '@/hooks/useT'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/cn'

export function Notifications() {
  const t = useT()
  usePageTitle(t('notifications.title'))
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const notifications = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await notificationsApi.list()).data.data,
  })

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markAllRead = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const openNotification = async (id: string, link?: string) => {
    const item = notifications.data?.items.find((notification) => notification._id === id)
    if (item && !item.isRead) await markRead.mutateAsync(id)
    if (link) navigate(link)
  }

  return (
    <>
      <PageHero
        kicker={t('account.kicker')}
        title={t('notifications.heading')}
        description={t('notifications.body')}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/account" className="text-sm font-medium text-[var(--brand-text)] hover:underline">
            {t('orders.backToAccount')}
          </Link>
          {notifications.data?.unread ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              {t('notifications.markAll')}
            </Button>
          ) : null}
        </div>
      </PageHero>

      <Container className="py-8 sm:py-10">
        {notifications.isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : notifications.isError ? (
          <QueryErrorState
            title={t('account.loadError')}
            description={t('account.loadErrorBody')}
            onRetry={() => notifications.refetch()}
          />
        ) : !notifications.data?.items.length ? (
          <EmptyState
            icon="inbox"
            title={t('notifications.emptyTitle')}
            description={t('notifications.emptyBody')}
          />
        ) : (
          <div className="mx-auto max-w-3xl space-y-2.5">
            {notifications.data.items.map((item) => (
              <button
                key={item._id}
                type="button"
                onClick={() => void openNotification(item._id, item.link)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-2xl border p-4 text-start transition hover:border-[var(--brand)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]',
                  item.isRead
                    ? 'border-[var(--border)] bg-[var(--bg-elevated)]'
                    : 'border-[color-mix(in_srgb,var(--brand)_38%,var(--border))] bg-[color-mix(in_srgb,var(--brand)_7%,var(--bg-elevated))]'
                )}
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg-muted)] text-[var(--brand-text)]">
                  <SiteIcon name={item.type === 'order' ? 'package' : 'inbox'} size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-[var(--fg)]">{item.title}</span>
                    <span className="text-xs text-[var(--fg-muted)]">
                      {formatDateTime(item.createdAt)}
                    </span>
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-[var(--fg-muted)]">
                    {item.message}
                  </span>
                </span>
                {!item.isRead ? (
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--brand)]" aria-label={t('notifications.unread')} />
                ) : null}
              </button>
            ))}
          </div>
        )}
      </Container>
    </>
  )
}
