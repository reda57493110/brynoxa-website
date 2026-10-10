import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { wholesaleApi } from '@/api/wholesaleApi'
import { getErrorMessage } from '@/api/client'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { surfaceCard } from '@/components/layout/pageStyles'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/store/toastStore'
import { formatDate } from '@/lib/format'
import { useT } from '@/hooks/useT'
import { cn } from '@/lib/cn'
import type { MyWholesale, WholesaleApplicationPayload } from '@/types'

type RequestedType = WholesaleApplicationPayload['requestedType']

/** Account settings card: apply for, or view, a wholesale / business account. */
export function WholesaleAccount({ className }: { className?: string }) {
  const t = useT()
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)

  const query = useQuery({
    queryKey: ['wholesale-me', user?._id],
    queryFn: async () => (await wholesaleApi.me()).data.data,
    enabled: Boolean(user),
  })

  if (!user) return null

  return (
    <section className={cn(surfaceCard, 'max-w-2xl p-5 sm:p-6', className)}>
      <h2 className="font-display text-lg font-semibold">{t('wholesale.title')}</h2>
      {query.isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : query.isError || !query.data ? (
        <div className="mt-3 space-y-3 text-sm">
          <p className="text-[var(--fg-muted)]">{getErrorMessage(query.error, t('wholesale.loadError'))}</p>
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => query.refetch()}>
            {t('wholesale.retry')}
          </Button>
        </div>
      ) : (
        <WholesaleBody
          data={query.data}
          onApplied={(next) => {
            qc.setQueryData(['wholesale-me', user._id], next)
            qc.invalidateQueries({ queryKey: ['wholesale-pricing'] })
          }}
        />
      )}
    </section>
  )
}

function WholesaleBody({
  data,
  onApplied,
}: {
  data: MyWholesale
  onApplied: (next: MyWholesale) => void
}) {
  const t = useT()

  if (data.status === 'pending') {
    return (
      <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4 text-sm">
        <p className="flex items-center gap-2 font-medium text-[var(--fg)]">
          <SiteIcon name="package-check" size={16} className="shrink-0 text-[var(--brand-text)]" />
          {t('wholesale.pendingTitle')}
        </p>
        <p className="mt-1.5 text-[var(--fg-muted)]">
          {data.requestedAt
            ? t('wholesale.pendingBody', {
                company: data.business?.companyName || '—',
                date: formatDate(data.requestedAt),
              })
            : t('wholesale.pendingBodyNoDate', { company: data.business?.companyName || '—' })}
        </p>
      </div>
    )
  }

  if (data.status === 'approved') {
    return (
      <div className="mt-3 rounded-xl border border-[var(--brand)]/40 bg-[var(--brand)]/[0.06] p-4 text-sm">
        <p className="flex items-center gap-2 font-medium text-[var(--fg)]">
          <SiteIcon name="shield" size={16} className="shrink-0 text-[var(--brand-text)]" />
          {t('wholesale.approvedTitle')}
        </p>
        {data.business?.companyName ? (
          <p className="mt-1.5 text-[var(--fg-muted)]">{data.business.companyName}</p>
        ) : null}
        {data.terms ? (
          <>
            <p className="mt-2 text-[var(--fg)]">
              {t('wholesale.approvedTier', { tier: data.terms.tierName })}
            </p>
            <p className="mt-1 font-semibold text-[var(--brand-text)]">
              {t('wholesale.approvedDiscount', { percent: data.terms.discountPercent })}
            </p>
          </>
        ) : (
          <p className="mt-2 text-[var(--fg-muted)]">{t('wholesale.approvedNoTier')}</p>
        )}
        {data.paymentTerms ? (
          <p className="mt-2 text-[var(--fg-muted)]">
            {t('wholesale.paymentTerms')}:{' '}
            <span className="text-[var(--fg)]">{data.paymentTerms}</span>
          </p>
        ) : null}
      </div>
    )
  }

  return <WholesaleApplyForm data={data} onApplied={onApplied} />
}

function WholesaleApplyForm({
  data,
  onApplied,
}: {
  data: MyWholesale
  onApplied: (next: MyWholesale) => void
}) {
  const t = useT()
  const user = useAuthStore((s) => s.user)
  const prev = data.business
  const [requestedType, setRequestedType] = useState<RequestedType>(
    data.requestedType || 'wholesale'
  )
  const [companyName, setCompanyName] = useState(prev?.companyName || '')
  const [contactName, setContactName] = useState(prev?.contactName || user?.name || '')
  const [email, setEmail] = useState(prev?.email || user?.email || '')
  const [phone, setPhone] = useState(prev?.phone || user?.phone || '')
  const [address, setAddress] = useState(prev?.address || '')
  const [taxId, setTaxId] = useState(prev?.taxId || '')
  const [message, setMessage] = useState('')

  const apply = useMutation({
    mutationFn: () => {
      const opt = (v: string) => v.trim() || undefined
      return wholesaleApi.apply({
        requestedType,
        business: {
          companyName: companyName.trim(),
          phone: phone.trim(),
          contactName: opt(contactName),
          email: opt(email),
          address: opt(address),
          taxId: opt(taxId),
        },
        message: opt(message),
      })
    },
    onSuccess: (res) => {
      toast.success(t('wholesale.submitted'))
      onApplied(res.data.data)
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    apply.mutate()
  }

  return (
    <>
      <p className="mt-1 text-sm text-[var(--fg-muted)]">{t('wholesale.intro')}</p>

      {data.status === 'rejected' ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          <p className="font-medium">{t('wholesale.rejectedTitle')}</p>
          {data.rejectionReason ? (
            <p className="mt-1">{t('wholesale.rejectedReason', { reason: data.rejectionReason })}</p>
          ) : null}
        </div>
      ) : null}

      <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={onSubmit}>
        <div className="sm:col-span-2">
          <Select
            label={t('wholesale.typeLabel')}
            value={requestedType}
            onChange={(e) => setRequestedType(e.target.value as RequestedType)}
            options={[
              { value: 'wholesale', label: t('wholesale.typeWholesale') },
              { value: 'business', label: t('wholesale.typeBusiness') },
            ]}
          />
        </div>
        <Input
          label={`${t('wholesale.companyName')} *`}
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          autoComplete="organization"
          minLength={2}
          maxLength={120}
          required
        />
        <Input
          label={t('wholesale.contactName')}
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          autoComplete="name"
          maxLength={120}
        />
        <Input
          label={t('wholesale.businessEmail')}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <Input
          label={`${t('wholesale.businessPhone')} *`}
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
          minLength={6}
          maxLength={40}
          required
        />
        <div className="sm:col-span-2">
          <Input
            label={t('wholesale.businessAddress')}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            autoComplete="street-address"
          />
        </div>
        <div className="sm:col-span-2">
          <Input
            label={t('wholesale.taxId')}
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <Textarea
            label={t('wholesale.message')}
            placeholder={t('wholesale.messagePlaceholder')}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={1000}
            rows={3}
          />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" className="w-full rounded-full sm:w-auto" loading={apply.isPending}>
            {data.status === 'rejected' ? t('wholesale.reapply') : t('wholesale.submit')}
          </Button>
        </div>
      </form>
    </>
  )
}
