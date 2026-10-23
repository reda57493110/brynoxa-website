import { LOCALES, type Locale } from '@/i18n'
import { useT } from '@/hooks/useT'
import { useLocaleStore } from '@/store/localeStore'
import { localizedPath } from '@/lib/localePath'
import { cn } from '@/lib/cn'

export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)

  return (
    <label className={cn('relative inline-flex', className)}>
      <span className="sr-only">{t('nav.language')}</span>
      <select
        value={locale}
        onChange={(e) => {
          const next = e.target.value as Locale
          // Each language has its own address (/fr/…, /ar/…): open the same page there
          try {
            localStorage.setItem('brynoxa-locale', JSON.stringify({ state: { locale: next }, version: 0 }))
          } catch {
            /* the address alone is enough */
          }
          const { pathname, search, hash } = window.location
          window.location.assign(localizedPath(pathname, next) + search + hash)
        }}
        className="h-9 cursor-pointer appearance-none rounded-full border border-transparent bg-transparent px-2.5 text-xs font-semibold tracking-wide text-[var(--fg)] outline-none ring-brand transition hover:bg-[var(--bg-muted)]"
        aria-label={t('nav.language')}
      >
        {LOCALES.map((item) => (
          <option key={item.id} value={item.id}>
            {item.native}
          </option>
        ))}
      </select>
    </label>
  )
}
