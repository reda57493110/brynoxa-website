import { Link } from 'react-router-dom'
import { Container } from '@/components/ui/Container'
import { SiteIcon, type SiteIconName } from '@/components/ui/SiteIcon'
import { useT } from '@/hooks/useT'
import { whatsappHref } from '@/lib/whatsapp'

type Item = { icon: SiteIconName; title: string; body: string; to?: string; href?: string }

/**
 * Home: four short promises in one strip, like the shops' service bar — pay cash at the door,
 * delivery to every city, 14 days to return, help on WhatsApp. Each opens the page that explains
 * it. (Warranty is said on the product page, where each product shows its own.)
 */
export function HomeTrustBar() {
  const t = useT()
  const items: Item[] = [
    { icon: 'banknote', title: t('home.trustCodTitle'), body: t('home.trustCodBody'), to: '/services/cash-on-delivery' },
    { icon: 'truck', title: t('home.trustDeliveryTitle'), body: t('home.trustDeliveryBody'), to: '/services/home-delivery' },
    { icon: 'refresh', title: t('home.trustReturnsTitle'), body: t('home.trustReturnsBody'), to: '/services/returns' },
    { icon: 'chat', title: t('home.trustHelpTitle'), body: t('home.trustHelpBody'), href: whatsappHref() },
  ]
  const tile = 'group flex h-full items-center gap-2.5 px-2.5 py-3 transition hover:bg-[rgb(0_194_255/0.06)] sm:gap-3.5 sm:px-5 sm:py-4 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--brand)]'

  return (
    <section aria-label={t('home.trustLabel')} className="pt-2.5 sm:pt-4">
      <Container>
        <ul className="grid grid-cols-2 divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] max-lg:[&>li:nth-child(-n+2)]:border-b max-lg:[&>li:nth-child(odd)]:border-e lg:grid-cols-4 lg:divide-x rtl:lg:divide-x-reverse">
          {items.map((it) => {
            const inner = (
              <>
                <SiteIcon name={it.icon} size={26} className="shrink-0 text-[var(--brand)] transition group-hover:scale-110" />
                <span className="min-w-0">
                  <span className="block text-[12px] font-extrabold uppercase leading-tight tracking-tight text-[var(--fg)] sm:text-sm">{it.title}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-[var(--fg-muted)] sm:text-[13px]">{it.body}</span>
                </span>
              </>
            )
            return (
              <li key={it.icon} className="border-[var(--border)]">
                {it.href ? (
                  <a href={it.href} target="_blank" rel="noopener noreferrer" className={tile}>
                    {inner}
                  </a>
                ) : (
                  <Link to={it.to!} className={tile}>
                    {inner}
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      </Container>
    </section>
  )
}
