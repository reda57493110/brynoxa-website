import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { Pagination } from '@/components/ui/Pagination'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { Panel } from '@/components/admin/Panel'
import { formatDate, formatDateTime } from '@/lib/format'
import { toast } from '@/store/toastStore'
import { cn } from '@/lib/cn'
import type { ContactInboxMessage } from '@/types'

type Status = ContactInboxMessage['status']
type Tab = 'messages' | 'newsletter'

const FILTERS: { id: '' | Status; label: string }[] = [
  { id: '', label: 'All' },
  { id: 'new', label: 'Unread' },
  { id: 'read', label: 'Read' },
  { id: 'archived', label: 'Archived' },
]

const pill = (on: boolean) =>
  cn(
    'h-8 rounded-full border px-3 text-sm transition',
    on
      ? 'border-transparent bg-[color-mix(in_srgb,var(--brand)_16%,transparent)] font-medium text-[var(--brand-text)]'
      : 'border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)]'
  )

function MessagesTab() {
  const qc = useQueryClient()
  const [status, setStatus] = useState<'' | Status>('')
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<string | null>(null)

  const messages = useQuery({
    queryKey: ['admin-messages', { page, status }],
    queryFn: async () => {
      const res = await adminApi.messages.list({ page, limit: 20, status: status || undefined })
      return { items: res.data.data, meta: res.data.meta }
    },
  })

  const update = useMutation({
    mutationFn: ({ id, next }: { id: string; next: Status; silent?: boolean }) => adminApi.messages.update(id, next),
    onSuccess: (_res, v) => {
      qc.invalidateQueries({ queryKey: ['admin-messages'] })
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] })
      if (!v.silent) toast.success(v.next === 'archived' ? 'Archived' : v.next === 'new' ? 'Marked unread' : 'Marked read')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const busy = (id: string) => update.isPending && update.variables?.id === id

  const toggle = (m: ContactInboxMessage) => {
    const opening = openId !== m._id
    setOpenId(opening ? m._id : null)
    // Opening an unread message marks it read, like any inbox
    if (opening && m.status === 'new') update.mutate({ id: m._id, next: 'read', silent: true })
  }

  const items = messages.data?.items ?? []

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id || 'all'}
            type="button"
            aria-pressed={status === f.id}
            onClick={() => {
              setStatus(f.id)
              setPage(1)
            }}
            className={pill(status === f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {messages.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : messages.isError ? (
        <QueryErrorState onRetry={() => messages.refetch()} />
      ) : items.length ? (
        <>
          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)]">
            {items.map((m) => {
              const open = openId === m._id
              const unread = m.status === 'new'
              return (
                <li key={m._id} className={cn(open && 'bg-[var(--bg-muted)]/40')}>
                  <button
                    type="button"
                    onClick={() => toggle(m)}
                    aria-expanded={open}
                    className="flex w-full min-w-0 items-start gap-3 px-4 py-3 text-start hover:bg-[var(--bg-muted)]/40"
                  >
                    <span
                      className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', unread ? 'bg-[var(--brand)]' : 'bg-transparent')}
                      aria-label={unread ? 'Unread' : undefined}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-baseline justify-between gap-3">
                        <span className={cn('truncate text-sm', unread ? 'font-semibold' : 'font-medium')}>{m.subject}</span>
                        <span className="shrink-0 text-[11px] text-[var(--fg-muted)]">{formatDate(m.createdAt)}</span>
                      </span>
                      <span className="block truncate text-xs text-[var(--fg-muted)]">
                        {m.name} · {m.email}
                        {m.status === 'archived' ? ' · archived' : ''}
                      </span>
                      {!open ? <span className="mt-0.5 block truncate text-xs text-[var(--fg-muted)]">{m.message}</span> : null}
                    </span>
                  </button>
                  {open ? (
                    <div className="space-y-3 px-4 pb-4 ps-9">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.message}</p>
                      <p className="text-[11px] text-[var(--fg-muted)]">Received {formatDateTime(m.createdAt)}</p>
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={`mailto:${m.email}?subject=${encodeURIComponent('Re: ' + m.subject)}`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[var(--brand)] px-3 text-sm font-medium text-[var(--brand-fg)]"
                        >
                          <SiteIcon name="mail" size={14} /> Reply
                        </a>
                        {m.status !== 'new' ? (
                          <Button size="sm" variant="ghost" disabled={busy(m._id)} onClick={() => update.mutate({ id: m._id, next: 'new' })}>
                            Mark unread
                          </Button>
                        ) : null}
                        {m.status !== 'archived' ? (
                          <Button size="sm" variant="outline" loading={busy(m._id)} onClick={() => update.mutate({ id: m._id, next: 'archived' })}>
                            Archive
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" loading={busy(m._id)} onClick={() => update.mutate({ id: m._id, next: 'read' })}>
                            Move to inbox
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
          <Pagination page={page} pages={messages.data?.meta?.pages || 1} onChange={setPage} />
        </>
      ) : (
        <p className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-10 text-center text-sm text-[var(--fg-muted)]">
          {status ? 'No messages in this filter.' : 'No messages yet. They arrive from the Contact page.'}
        </p>
      )}
    </div>
  )
}

function NewsletterTab() {
  const subscribers = useQuery({
    queryKey: ['admin-subscribers'],
    queryFn: async () => (await adminApi.subscribers.list()).data.data,
  })
  const list = subscribers.data ?? []

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(list.map((s) => s.email).join(', '))
      toast.success(`${list.length} emails copied`)
    } catch {
      toast.error('Could not copy — select the emails manually')
    }
  }

  if (subscribers.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }
  if (subscribers.isError) return <QueryErrorState onRetry={() => subscribers.refetch()} />

  return (
    <Panel
      title={`${list.length} active subscriber${list.length === 1 ? '' : 's'}`}
      description="People who signed up to the newsletter on the store."
      actions={
        list.length ? (
          <Button size="sm" variant="outline" onClick={() => void copyAll()}>
            Copy all emails
          </Button>
        ) : null
      }
    >
      {list.length ? (
        <ul className="-my-2 max-h-[28rem] divide-y divide-[var(--border)] overflow-y-auto">
          {list.map((s) => (
            <li key={s._id} className="flex min-w-0 items-center justify-between gap-3 py-2 text-sm">
              <span className="truncate">{s.email}</span>
              <span className="shrink-0 text-xs text-[var(--fg-muted)]">{formatDate(s.createdAt)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--fg-muted)]">No subscribers yet.</p>
      )}
    </Panel>
  )
}

export function Messages() {
  const [tab, setTab] = useState<Tab>('messages')

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <AdminHeader title="Inbox" description="Contact form messages and newsletter signups." />
      <div role="tablist" className="flex gap-1 border-b border-[var(--border)]">
        {(
          [
            { id: 'messages', label: 'Messages' },
            { id: 'newsletter', label: 'Newsletter' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition',
              tab === t.id ? 'border-[var(--brand)] text-[var(--fg)]' : 'border-transparent text-[var(--fg-muted)] hover:text-[var(--fg)]'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'messages' ? <MessagesTab /> : <NewsletterTab />}
    </div>
  )
}
