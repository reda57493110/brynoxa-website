import { Link } from 'react-router-dom'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { Container } from '@/components/ui/Container'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { SocialGlyph } from '@/components/contact/BrandIcons'
import { PhoneText } from '@/components/ui/PhoneText'
import { CONTACT, SOCIAL_LINKS } from '@/lib/site'
import { cn } from '@/lib/cn'
import { useT } from '@/hooks/useT'
import { useWhatsAppStore } from '@/store/whatsappStore'

const explore = [
  { to: '/shop', key: 'common.shop' as const },
  { to: '/services', key: 'common.services' as const },
  { to: '/contact', key: 'common.contact' as const },
]

const support = [
  { to: '/services#warranty', key: 'footer.warranty' as const },
  { to: '/services#returns', key: 'footer.returns' as const },
  { to: '/account', key: 'footer.myAccount' as const },
]

const linkClass =
  'rounded-sm text-sm text-[var(--fg-muted)] transition hover:text-[var(--brand-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]'

function FooterHeading({ children }: { children: string }) {
  return (
    <p className="font-display text-xs font-semibold tracking-tight text-[var(--fg)] sm:text-sm">
      {children}
    </p>
  )
}

export function Footer() {
  const t = useT()
  const openWhatsAppPicker = useWhatsAppStore((s) => s.open)

  return (
    <footer className="mt-auto border-t border-[var(--border)] bg-[var(--bg-elevated)] pb-[env(safe-area-inset-bottom)]">
      <Container className="grid gap-5 py-5 sm:grid-cols-2 sm:gap-8 sm:py-8 lg:grid-cols-[minmax(0,1.4fr)_1fr_1fr_minmax(0,1.15fr)] lg:gap-8 lg:py-10">
        <div className="sm:col-span-2 lg:col-span-1">
          <div className="flex flex-wrap items-center gap-3">
            <BrandLogo markClassName="h-8 w-8" />
            <div className="flex gap-1.5" aria-label={t('nav.social')}>
              {SOCIAL_LINKS.map((s) =>
                s.id === 'whatsapp' ? (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => openWhatsAppPicker()}
                    aria-label={t('nav.socialOpens', { name: s.name })}
                    className={cn(
                      'inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)]',
                      'transition hover:border-[var(--brand)] hover:text-[var(--brand-text)]',
                      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]'
                    )}
                  >
                    <SocialGlyph id={s.id} size={14} />
                  </button>
                ) : (
                  <a
                    key={s.id}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t('nav.socialOpens', { name: s.name })}
                    className={cn(
                      'inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)]',
                      'transition hover:border-[var(--brand)] hover:text-[var(--brand-text)]',
                      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]'
                    )}
                  >
                    <SocialGlyph id={s.id} size={14} />
                  </a>
                )
              )}
            </div>
          </div>
          <p className="mt-2 max-w-sm text-xs leading-snug text-[var(--fg-muted)] sm:mt-3 sm:max-w-xs sm:text-sm sm:leading-relaxed">
            {t('footer.tagline')}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:contents">
          <nav aria-label={t('footer.explore')}>
            <FooterHeading>{t('footer.explore')}</FooterHeading>
            <ul className="mt-2 flex flex-col gap-1.5 sm:mt-3 sm:gap-2">
              {explore.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className={linkClass}>
                    {t(item.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label={t('footer.support')}>
            <FooterHeading>{t('footer.support')}</FooterHeading>
            <ul className="mt-2 flex flex-col gap-1.5 sm:mt-3 sm:gap-2">
              {support.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className={linkClass}>
                    {t(item.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="sm:col-span-2 lg:col-span-1">
          <FooterHeading>{t('footer.contact')}</FooterHeading>
          <ul className="mt-2 flex flex-wrap gap-2 sm:mt-3 lg:flex-col lg:gap-2">
            <li>
              <button
                type="button"
                onClick={() => openWhatsAppPicker()}
                className={cn(linkClass, 'inline-flex items-center gap-2')}
              >
                <SiteIcon name="chat" size={14} className="shrink-0 text-[var(--brand-text)]" />
                <PhoneText className="truncate">{CONTACT.whatsapp.value}</PhoneText>
              </button>
            </li>
            <li>
              <a
                href={CONTACT.email.href}
                className={cn(linkClass, 'inline-flex items-center gap-2')}
              >
                <SiteIcon name="mail" size={14} className="shrink-0 text-[var(--brand-text)]" />
                <span className="truncate">{CONTACT.email.value}</span>
              </a>
            </li>
          </ul>
        </div>
      </Container>

      <div className="border-t border-[var(--border)]">
        <Container className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-3">
          <p className="text-[11px] text-[var(--fg-muted)] sm:text-xs">
            {t('footer.copyright', { year: new Date().getFullYear() })}
          </p>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-[var(--fg-muted)] sm:gap-x-3 sm:text-xs">
            <span>{t('footer.warrantyBadge')}</span>
            <span className="hidden h-1 w-1 rounded-full bg-[var(--border)] sm:inline" aria-hidden="true" />
            <span className="hidden sm:inline">{t('footer.noCard')}</span>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="inline-flex items-center gap-1 font-medium text-[var(--brand-text)] transition hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
            >
              {t('footer.backToTop')}
              <SiteIcon name="arrow-up" size={11} />
            </button>
          </div>
        </Container>
      </div>
    </footer>
  )
}
