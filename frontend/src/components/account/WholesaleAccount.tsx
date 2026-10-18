import { useQuery } from '@tanstack/react-query'
import { wholesaleApi } from '@/api/wholesaleApi'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { surfaceCard } from '@/components/layout/pageStyles'
import { useAuthStore } from '@/store/authStore'
import { useT } from '@/hooks/useT'
import { cn } from '@/lib/cn'

/**
 * Account settings card for wholesale / business customers: their tier, discount and payment terms.
 * Staff set these accounts up in Admin → Customers; retail customers see nothing here.
 */
export function WholesaleAccount({ className }: { className?: string }) {
  const t = useT()
  const user = useAuthStore((s) => s.user)

  const query = useQuery({
    queryKey: ['wholesale-me', user?._id],
    queryFn: async () => (await wholesaleApi.me()).data.data,
    enabled: Boolean(user),
  })

  const data = query.data
  if (!user || data?.status !== 'approved') return null

  return (
    <section className={cn(surfaceCard, 'max-w-2xl p-5 sm:p-6', className)}>
      <h2 className="font-display text-lg font-semibold">{t('wholesale.title')}</h2>
      <div className="mt-3 rounded-xl border border-[var(--brand)]/40 bg-[var(--brand)]/[0.06] p-4 text-sm">
        <p className="flex items-center gap-2 font-medium text-[var(--fg)]">
          <SiteIcon name="shield" size={16} className="shrink-0 text-[var(--brand-text)]" />
          {t('wholesale.approvedTitle')}
        </p>
        {data.business?.companyName ? <p className="mt-1.5 text-[var(--fg-muted)]">{data.business.companyName}</p> : null}
        {data.terms ? (
          <>
            <p className="mt-2 text-[var(--fg)]">{t('wholesale.approvedTier', { tier: data.terms.tierName })}</p>
            <p className="mt-1 font-semibold text-[var(--brand-text)]">
              {t('wholesale.approvedDiscount', { percent: data.terms.discountPercent })}
            </p>
          </>
        ) : (
          <p className="mt-2 text-[var(--fg-muted)]">{t('wholesale.approvedNoTier')}</p>
        )}
        {data.paymentTerms ? (
          <p className="mt-2 text-[var(--fg-muted)]">
            {t('wholesale.paymentTerms')}: <span className="text-[var(--fg)]">{data.paymentTerms}</span>
          </p>
        ) : null}
      </div>
    </section>
  )
}
