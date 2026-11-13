import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi, type PhoneHistory } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { toast } from '@/store/toastStore'
import { formatCurrency, formatDate } from '@/lib/format'
import { orderStatusLabel } from '@/lib/orderStatus'
import { cn } from '@/lib/cn'

const LOOK: Record<PhoneHistory['risk'], { title: string; tone: string; icon: 'alert' | 'check' | 'user' | 'shield' }> = {
  blocked: { title: 'Blocked number', tone: 'border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] text-[var(--danger)]', icon: 'shield' },
  high: { title: 'Refused or sent back before', tone: 'border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] text-[var(--danger)]', icon: 'alert' },
  watch: { title: 'Check before shipping', tone: 'border-[var(--warning)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] text-[var(--warning)]', icon: 'alert' },
  good: { title: 'Good customer', tone: 'border-[var(--success)] bg-[color-mix(in_srgb,var(--success)_8%,transparent)] text-[var(--success)]', icon: 'check' },
  new: { title: 'First order from this number', tone: 'border-[var(--border)] bg-[var(--bg-muted)] text-[var(--fg-muted)]', icon: 'user' },
}

/**
 * Order page: what this phone number's other orders say (delivered, refused / sent back,
 * cancelled), and Block / Unblock, so fake cash-on-delivery orders are caught before shipping.
 */
export function PhoneRiskCard({ phone, orderId }: { phone?: string; orderId: string }) {
  const qc = useQueryClient()
  const [asking, setAsking] = useState(false)
  const [reason, setReason] = useState('')
  const digits = String(phone ?? '').replace(/\D/g, '')
  const history = useQuery({
    queryKey: ['phone-history', digits, orderId],
    queryFn: async () => (await adminApi.phoneGuard.history(phone!, orderId)).data.data,
    enabled: digits.length >= 8,
    staleTime: 60_000,
  })
  const done = () => {
    qc.invalidateQueries({ queryKey: ['phone-history'] })
    qc.invalidateQueries({ queryKey: ['blocked-phones'] })
  }
  const block = useMutation({
    mutationFn: () => adminApi.phoneGuard.block(phone!, reason.trim() || undefined),
    onSuccess: () => {
      done()
      setAsking(false)
      toast.success('Number blocked: it can no longer order on the website')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const unblock = useMutation({
    mutationFn: () => adminApi.phoneGuard.unblock(history.data?.blocked?._id ?? phone!),
    onSuccess: () => {
      done()
      toast.success('Number unblocked')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  if (digits.length < 8 || history.isLoading || history.isError || !history.data) return null
  const h = history.data
  const look = LOOK[h.risk]
  const parts = [
    h.delivered ? `${h.delivered} delivered` : null,
    h.refused ? `${h.refused} refused / sent back` : null,
    h.cancelled ? `${h.cancelled} cancelled` : null,
    h.failedAttempts ? `${h.failedAttempts} failed delivery attempt${h.failedAttempts === 1 ? '' : 's'}` : null,
  ].filter(Boolean)

  return (
    <div className={cn('rounded-xl border p-3 text-sm sm:rounded-2xl', look.tone)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-semibold">
            <SiteIcon name={look.icon} size={15} /> {look.title}
          </p>
          <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
            {h.orders
              ? `Other orders from this number: ${h.orders}${parts.length ? ` · ${parts.join(' · ')}` : ''}`
              : 'No other order from this number.'}
            {h.blocked?.reason ? ` · Blocked: ${h.blocked.reason}` : ''}
          </p>
        </div>
        {h.blocked ? (
          <Button size="sm" variant="outline" loading={unblock.isPending} onClick={() => unblock.mutate()}>
            Unblock
          </Button>
        ) : (
          <Button size="sm" variant={h.risk === 'high' ? 'danger' : 'ghost'} onClick={() => setAsking(true)}>
            <SiteIcon name="shield" size={13} /> Block this number
          </Button>
        )}
      </div>
      {h.recent.length ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {h.recent.map((r) => (
            <li key={r._id}>
              <Link
                to={`/admin/orders/${r._id}`}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 text-[11px] text-[var(--fg)] hover:text-[var(--brand-text)]"
                title={`${formatDate(r.createdAt)} · ${formatCurrency(r.total)}`}
              >
                {r.orderNumber.slice(-4)} · {orderStatusLabel(r.status)}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <Modal open={asking} onClose={() => setAsking(false)} title="Block this number?" size="sm">
        <div className="space-y-3 text-sm">
          <p className="text-[var(--fg-muted)]">
            <span dir="ltr" className="font-medium text-[var(--fg)]">{phone}</span> will no longer be able to order on the website (any way it is written). It is
            asked to contact you on WhatsApp instead. You can still enter an order for it yourself, and unblock it any time.
          </p>
          <Input label="Why (optional, only staff see it)" value={reason} maxLength={300} placeholder="e.g. refused 2 parcels" onChange={(e) => setReason(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAsking(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={block.isPending} onClick={() => block.mutate()}>
              Block
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
