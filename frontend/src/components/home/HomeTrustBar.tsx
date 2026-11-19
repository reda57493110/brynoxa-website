import { Link } from 'react-router-dom'
import { Container } from '@/components/ui/Container'
import { SiteIcon, type SiteIconName } from '@/components/ui/SiteIcon'
import { useT } from '@/hooks/useT'
import { whatsappHref } from '@/lib/whatsapp'

type Item = { icon: SiteIconName; title: string; body: string; to?: string; href?: string }

/**
 * Home: four short promises under the banner — pay cash at the door, delivery to every city,
 * 14 days to return, help on WhatsApp. Each opens the page that explains it. (Warranty is said
 * on the product page, where each product shows its own.)
 */
export function HomeTrustBar() {
  const t = useT()
  const items: Item[] = [
    { icon: 'banknote', title: t('home.trustCodTitle'), body: t('home.trustCodBody'), to: '/services/cash-on-delivery' },
    { icon: 'truck', title: t('home.trustDeliveryTitle'), body: t('home.trustDeliveryBody'), to: '/services/home-delivery' },
    { icon: 'refresh', title: t('home.trustReturnsTitle'), body: t('home.trustReturnsBody'), to: '/services/returns' },
    { icon: 'chat', title: t('home.trustHelpTitle'), body: t('home.trustHelpBody'), href: whatsappHref() },
  ]
  const tile =
    'group flex h-full items-center gap-2.5 rounded-xl p-2 transition hover:bg-[var(--bg-muted)] sm:gap-3.5 sm:p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)]'

  return (
    <section aria-label={t('home.trustLabel')} className="pt-3 sm:pt-5">
      <Container>
        <ul className="grid grid-cols-2 gap-1 rounded-[1.25rem] border border-[var(--border)] bg-[var(--bg-elevated)] p-1.5 shadow-soft sm:gap-2 sm:rounded-[1.5rem] sm:p-2 lg:grid-cols-4">
          {items.map((it) => {
            const inner = (
              <>
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] text-[var(--brand-text)] transition group-hover:bg-[var(--brand)] group-hover:text-[var(--brand-fg)] sm:size-11">
                  <SiteIcon name={it.icon} size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-semibold leading-tight text-[var(--fg)] sm:text-[15px]">{it.title}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-[var(--fg-muted)] sm:text-[13px]">{it.body}</span>
                </span>
              </>
            )
            return (
              <li key={it.icon}>
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
