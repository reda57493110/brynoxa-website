import { LOCALES, type Locale } from '@/i18n'
import { useT } from '@/hooks/useT'
import { useLocaleStore } from '@/store/localeStore'
import { cn } from '@/lib/cn'

export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  const setLocale = useLocaleStore((s) => s.setLocale)

  return (
    <label className={cn('relative inline-flex', className)}>
      <span className="sr-only">{t('nav.language')}</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
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
