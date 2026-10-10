import { useDeferredValue, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { toast } from '@/store/toastStore'
import type { Order, User } from '@/types'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const card = 'rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 sm:p-5'

/** Starting points for common messages — edit freely before sending. */
const TEMPLATES = [
  {
    label: 'Order delayed',
    subject: 'An update on your order',
    message:
      'We wanted to let you know that your order is taking a little longer than expected. We are sorry for the wait — we will contact you as soon as it ships.',
  },
  {
    label: 'Need more details',
    subject: 'We need a detail to process your order',
    message:
      'To finish preparing your order, we need to confirm a detail with you. Could you reply to this email or message us on WhatsApp?',
  },
  {
    label: 'Back in stock',
    subject: 'Good news — it is back in stock',
    message:
      'The product you were interested in is back in stock. Reply to this email or message us on WhatsApp if you would like us to reserve one for you.',
  },
]

type PickedOrder = Pick<Order, '_id' | 'orderNumber' | 'pricing'> & { email?: string }

function orderEmail(order: Order) {
  return typeof order.user === 'object' ? (order.user as User).email : undefined
}

export function Emails() {
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const [to, setTo] = useState(params.get('to') || '')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [order, setOrder] = useState<PickedOrder | null>(null)
  const [orderQuery, setOrderQuery] = useState('')
  const [page, setPage] = useState(1)
  const [filterTo, setFilterTo] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const toQuery = useDeferredValue(to.trim())
  const orderQ = useDeferredValue(orderQuery.trim())

  // Coming from an order page: attach that order and its customer
  const linkedOrderId = params.get('order')
  const linkedOrder = useQuery({
    queryKey: ['admin-order', linkedOrderId],
    queryFn: async () => (await adminApi.orders.get(linkedOrderId!)).data.data,
    enabled: Boolean(linkedOrderId),
  })
  useEffect(() => {
    const o = linkedOrder.data
    if (!o) return
    setOrder({ _id: o._id, orderNumber: o.orderNumber, pricing: o.pricing, email: orderEmail(o) })
    setTo((current) => current || orderEmail(o) || '')
  }, [linkedOrder.data])

  const customers = useQuery({
    queryKey: ['admin-customers', 'email-search', toQuery],
    queryFn: async () => (await adminApi.customers.list({ q: toQuery, limit: 5 })).data.data,
    enabled: toQuery.length >= 2 && !EMAIL_RE.test(toQuery),
  })

  const orders = useQuery({
    queryKey: ['admin-orders', 'email-search', orderQ],
    queryFn: async () => (await adminApi.orders.list({ q: orderQ, limit: 5 })).data.data,
    enabled: orderQ.length >= 3,
  })

  const history = useQuery({
    queryKey: ['admin-emails', { page, filterTo }],
    queryFn: async () => {
      const res = await adminApi.emails.list({ page, limit: 15, to: filterTo || undefined })
      return { items: res.data.data, meta: res.data.meta }
    },
  })

  const send = useMutation({
    mutationFn: () =>
      adminApi.emails.send({ to: to.trim(), subject: subject.trim(), message: message.trim(), orderId: order?._id }),
    onSuccess: (res) => {
      toast.success(`Email sent to ${res.data.data.sentTo}`)
      setSubject('')
      setMessage('')
      qc.invalidateQueries({ queryKey: ['admin-emails'] })
    },
    onError: (e) => {
      toast.error(getErrorMessage(e))
      qc.invalidateQueries({ queryKey: ['admin-emails'] })
    },
  })

  const valid = EMAIL_RE.test(to.trim()) && subject.trim().length >= 2 && message.trim().length >= 2

  return (
    <div className="min-w-0 space-y-5">
      <AdminHeader
        title="Emails"
        description="Write to a customer. The email uses the Brynoxa design, and replies go to your support email (Settings)."
      />

      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <form
          className={`${card} min-w-0 space-y-4`}
          onSubmit={(e) => {
            e.preventDefault()
            if (valid && !send.isPending) send.mutate()
          }}
        >
          <h2 className="font-display text-base font-semibold">Write an email</h2>

          <div>
            <Input
              label="To"
              type="text"
              inputMode="email"
              placeholder="customer@email.com — or search a customer by name or phone"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              autoComplete="off"
            />
            {customers.data?.length ? (
              <ul className="mt-2 space-y-1">
                {customers.data.map((c) => (
                  <li key={c._id}>
                    <button
                      type="button"
                      onClick={() => setTo(c.email)}
                      className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-start text-sm transition hover:bg-[var(--bg-muted)]"
                    >
                      <SiteIcon name="user" size={15} className="shrink-0 text-[var(--fg-muted)]" />
                      <span className="min-w-0 truncate">
                        {c.name} <span className="text-[var(--fg-muted)]">· {c.email}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div>
            {order ? (
              <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/40 px-3 py-2">
                <SiteIcon name="package" size={16} className="shrink-0 text-[var(--brand-text)]" />
                <span className="min-w-0 flex-1 text-sm">
                  Order <span className="font-semibold">#{order.orderNumber}</span> ·{' '}
                  {formatCurrency(order.pricing.total)}
                  <span className="block text-xs text-[var(--fg-muted)]">
                    Its summary and a “View your order” button are added to the email.
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setOrder(null)}
                  className="text-[var(--fg-muted)] hover:text-[var(--danger)]"
                  aria-label="Remove attached order"
                >
                  <SiteIcon name="close" size={16} />
                </button>
              </div>
            ) : (
              <>
                <Input
                  label="Attach an order (optional)"
                  placeholder="Order number, e.g. BRX-20261010"
                  value={orderQuery}
                  onChange={(e) => setOrderQuery(e.target.value)}
                  autoComplete="off"
                />
                {orders.data?.length ? (
                  <ul className="mt-2 space-y-1">
                    {orders.data.map((o) => (
                      <li key={o._id}>
                        <button
                          type="button"
                          onClick={() => {
                            setOrder({ _id: o._id, orderNumber: o.orderNumber, pricing: o.pricing, email: orderEmail(o) })
                            setOrderQuery('')
                            if (!to.trim() && orderEmail(o)) setTo(orderEmail(o)!)
                          }}
                          className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-start text-sm transition hover:bg-[var(--bg-muted)]"
                        >
                          <SiteIcon name="package" size={15} className="shrink-0 text-[var(--fg-muted)]" />
                          <span className="min-w-0 truncate">
                            #{o.orderNumber} · {formatCurrency(o.pricing.total)}
                            {orderEmail(o) ? <span className="text-[var(--fg-muted)]"> · {orderEmail(o)}</span> : null}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
            {order?.email && to.trim() && order.email !== to.trim().toLowerCase() ? (
              <p className="mt-1.5 text-xs text-[var(--warning)]">
                This order belongs to {order.email}, not the address above.
              </p>
            ) : null}
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-[var(--fg-muted)]">Start from a template</p>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.label}
                  type="button"
                  onClick={() => {
                    setSubject(tpl.subject)
                    setMessage(tpl.message)
                  }}
                  className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium transition hover:border-[var(--brand)] hover:text-[var(--brand-text)]"
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} />
          <div>
            <Textarea
              label="Message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={8}
              maxLength={5000}
              placeholder="Write your message. Leave an empty line between paragraphs."
            />
            <p className="mt-1 text-end text-xs text-[var(--fg-muted)]">{message.length}/5000</p>
          </div>
          <p className="text-xs text-[var(--fg-muted)]">
            The email starts with “Hi [first name],” and ends with your WhatsApp and email contact.
          </p>
          <Button type="submit" disabled={!valid} loading={send.isPending}>
            <SiteIcon name="send" size={16} />
            Send email
          </Button>
        </form>

        <section className={`${card} min-w-0`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold">Sent emails</h2>
            {filterTo ? (
              <button
                type="button"
                onClick={() => {
                  setFilterTo('')
                  setPage(1)
                }}
                className="text-xs font-medium text-[var(--brand-text)] hover:underline"
              >
                Showing {filterTo} · show all
              </button>
            ) : null}
          </div>

          {history.isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : history.isError ? (
            <QueryErrorState onRetry={() => history.refetch()} />
          ) : history.data?.items.length ? (
            <>
              <ul className="mt-3 divide-y divide-[var(--border)]">
                {history.data.items.map((email) => {
                  const by = typeof email.sentBy === 'object' ? email.sentBy?.name || email.sentBy?.email : undefined
                  const open = openId === email._id
                  return (
                    <li key={email._id} className="py-3">
                      <button
                        type="button"
                        onClick={() => setOpenId(open ? null : email._id)}
                        className="w-full text-start"
                        aria-expanded={open}
                      >
                        <span className="flex items-start justify-between gap-2">
                          <span className="min-w-0 truncate text-sm font-medium">{email.subject}</span>
                          {email.status === 'failed' ? <Badge variant="danger">Failed</Badge> : <Badge variant="success">Sent</Badge>}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-[var(--fg-muted)]">
                          {email.to}
                          {email.orderNumber ? ` · #${email.orderNumber}` : ''} · {formatDateTime(email.createdAt)}
                          {by ? ` · by ${by}` : ''}
                        </span>
                      </button>
                      {open ? (
                        <div className="mt-2 rounded-xl bg-[var(--bg-muted)]/50 p-3">
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">{email.message}</p>
                          <div className="mt-2 flex flex-wrap gap-3 text-xs">
                            <button
                              type="button"
                              className="font-medium text-[var(--brand-text)] hover:underline"
                              onClick={() => {
                                setTo(email.to)
                                setSubject(`Re: ${email.subject}`.slice(0, 150))
                              }}
                            >
                              Write again
                            </button>
                            <button
                              type="button"
                              className="font-medium text-[var(--brand-text)] hover:underline"
                              onClick={() => {
                                setFilterTo(email.to)
                                setPage(1)
                              }}
                            >
                              All emails to this customer
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
              <Pagination page={page} pages={history.data.meta?.pages || 1} onChange={setPage} />
            </>
          ) : (
            <p className="mt-3 text-sm text-[var(--fg-muted)]">No emails sent yet.</p>
          )}
        </section>
      </div>
    </div>
  )
}
