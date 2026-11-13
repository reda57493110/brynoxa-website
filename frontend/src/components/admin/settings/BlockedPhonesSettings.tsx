import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { toast } from '@/store/toastStore'
import { formatDate } from '@/lib/format'
import { SettingsCard } from './SettingsUi'
import { useReportDirty } from './dirty'

/**
 * Settings → Customers & pricing → Blocked phone numbers: numbers that cannot order on the
 * website (fake orders, parcels refused). Also blocked / unblocked from an order's page.
 */
export function BlockedPhonesSettings() {
  const qc = useQueryClient()
  const [phone, setPhone] = useState('')
  const [reason, setReason] = useState('')
  useReportDirty('blocked-phone-new', Boolean(phone.trim()))
  const list = useQuery({
    queryKey: ['blocked-phones'],
    queryFn: async () => (await adminApi.phoneGuard.list()).data.data,
  })
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['blocked-phones'] })
    qc.invalidateQueries({ queryKey: ['phone-history'] })
  }
  const digits = phone.replace(/\D/g, '')
  const block = useMutation({
    mutationFn: () => adminApi.phoneGuard.block(phone.trim(), reason.trim() || undefined),
    onSuccess: (r) => {
      refresh()
      setPhone('')
      setReason('')
      toast.success(r.data.data.already ? 'This number was already blocked' : 'Number blocked')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const unblock = useMutation({
    mutationFn: (id: string) => adminApi.phoneGuard.unblock(id),
    onSuccess: () => {
      refresh()
      toast.success('Number unblocked')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <SettingsCard
      title="Blocked phone numbers"
      description="These numbers cannot order on the website (however the number is written); they are asked to contact you on WhatsApp. You can still enter an order for them in Orders → New order. Each order page also shows the number's history and a Block button."
    >
      <form
        className="grid gap-2 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto] sm:items-start"
        onSubmit={(e) => {
          e.preventDefault()
          if (digits.length >= 8) block.mutate()
        }}
      >
        <Input aria-label="Phone number" inputMode="tel" placeholder="06 12 34 56 78" value={phone} maxLength={40} onChange={(e) => setPhone(e.target.value)} />
        <Input aria-label="Why (optional)" placeholder="Why (optional, only staff see it)" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
        <Button type="submit" variant="danger" loading={block.isPending} disabled={digits.length < 8}>
          <SiteIcon name="shield" size={14} /> Block
        </Button>
      </form>

      <div className="mt-4">
        {list.isLoading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : list.isError ? (
          <QueryErrorState onRetry={() => list.refetch()} />
        ) : list.data?.length ? (
          <ul className="divide-y divide-[var(--border)]">
            {list.data.map((b) => (
              <li key={b._id} className="flex items-center gap-3 py-2 text-sm first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="font-medium" dir="ltr">{b.phone}</p>
                  <p className="truncate text-[11px] text-[var(--fg-muted)]">
                    {formatDate(b.createdAt)}
                    {b.by ? ` · by ${b.by}` : ''}
                    {b.reason ? ` · ${b.reason}` : ''}
                  </p>
                </div>
                <Button size="sm" variant="outline" disabled={unblock.isPending && unblock.variables === b._id} onClick={() => unblock.mutate(b._id)}>
                  Unblock
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-[var(--fg-muted)]">No blocked number.</p>
        )}
      </div>
    </SettingsCard>
  )
}
