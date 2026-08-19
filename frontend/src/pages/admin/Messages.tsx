import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { Pagination } from '@/components/ui/Pagination'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { formatDateTime } from '@/lib/format'
import { toast } from '@/store/toastStore'
import { cn } from '@/lib/cn'
import type { ContactInboxMessage } from '@/types'

export function Messages() {
  const qc = useQueryClient()
  const [status, setStatus] = useState<'' | ContactInboxMessage['status']>('')
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<string | null>(null)

  const messages = useQuery({
    queryKey: ['admin-messages', { page, status }],
    queryFn: async () => {
      const res = await adminApi.messages.list({
        page,
        limit: 20,
        status: status || undefined,
      })
      return { items: res.data.data, meta: res.data.meta }
    },
  })

  const subscribers = useQuery({
    queryKey: ['admin-subscribers'],
    queryFn: async () => (await adminApi.subscribers.list()).data.data,
  })

  const update = useMutation({
    mutationFn: ({ id, next }: { id: string; next: ContactInboxMessage['status'] }) =>
      adminApi.messages.update(id, next),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-messages'] })
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] })
      toast.success('Inbox updated')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const filters: { id: '' | ContactInboxMessage['status']; label: string }[] = [
    { id: '', label: 'All' },
    { id: 'new', label: 'New' },
    { id: 'read', label: 'Read' },
    { id: 'archived', label: 'Archived' },
  ]

  return (
    <div className="space-y-8">
      <AdminHeader
        title="Inbox"
        description="Contact form messages and newsletter signups, updated from the live store."
      />

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.id || 'all'}
            type="button"
            onClick={() => {
              setStatus(f.id)
              setPage(1)
            }}
            className={cn(
              'h-9 rounded-full border px-3 text-sm',
              status === f.id
                ? 'border-transparent bg-[color-mix(in_srgb,var(--brand)_16%,transparent)] text-[var(--brand-text)]'
                : 'border-[var(--border)]'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {messages.isLoading ? (
        <Spinner />
      ) : (
        <div className="space-y-3">
          {messages.data?.items.map((m) => {
            const open = openId === m._id
            return (
              <article
                key={m._id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button type="button" className="text-left" onClick={() => setOpenId(open ? null : m._id)}>
                    <p className="font-medium">{m.subject}</p>
                    <p className="text-sm text-[var(--fg-muted)]">
                      {m.name} · {m.email} · {formatDateTime(m.createdAt)}
                    </p>
                  </button>
                  <Badge variant={m.status === 'new' ? 'warning' : m.status === 'read' ? 'brand' : 'muted'}>
                    {m.status}
                  </Badge>
                </div>
                {open ? (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--fg-muted)]">
                    {m.message}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {m.status !== 'read' ? (
                    <Button size="sm" variant="outline" onClick={() => update.mutate({ id: m._id, next: 'read' })}>
                      Mark read
                    </Button>
                  ) : null}
                  {m.status !== 'archived' ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => update.mutate({ id: m._id, next: 'archived' })}
                    >
                      Archive
                    </Button>
                  ) : null}
                  <a
                    href={`mailto:${m.email}?subject=${encodeURIComponent('Re: ' + m.subject)}`}
                    className="inline-flex h-9 items-center rounded-full border border-[var(--border)] px-3 text-sm"
                  >
                    Reply
                  </a>
                </div>
              </article>
            )
          })}
          {!messages.data?.items.length ? (
            <p className="text-sm text-[var(--fg-muted)]">No messages in this filter.</p>
          ) : null}
          <Pagination page={page} pages={messages.data?.meta?.pages || 1} onChange={setPage} />
        </div>
      )}

      <section>
        <h2 className="font-display text-lg font-semibold">Newsletter</h2>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          {subscribers.data?.length ?? 0} active subscribers
        </p>
        <ul className="mt-3 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)]">
          {subscribers.data?.map((s) => (
            <li key={s._id} className="flex justify-between px-4 py-2 text-sm">
              <span>{s.email}</span>
              <span className="text-[var(--fg-muted)]">{formatDateTime(s.createdAt)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
