import { localeFromPath, localizedPath } from './lib/localePath'

try {
  const storedTheme = localStorage.getItem('brynoxa-theme')
  const theme = storedTheme ? JSON.parse(storedTheme)?.state?.theme : 'dark'
  const storedLocale = localStorage.getItem('brynoxa-locale')
  const saved = storedLocale ? JSON.parse(storedLocale)?.state?.locale : 'en'
  const { pathname, search, hash } = window.location
  const fromUrl = localeFromPath(pathname)

  // A French / Arabic visitor opening an English address goes to their language
  // (search engines keep no saved language, so they always get the address they asked for)
  const redirecting = !fromUrl && (saved === 'fr' || saved === 'ar') && !pathname.startsWith('/admin')
  if (redirecting) window.location.replace(localizedPath(pathname, saved) + search + hash)

  // The language in the address wins (and is remembered)
  const locale = fromUrl ?? 'en'
  if (!redirecting && locale !== saved) {
    localStorage.setItem('brynoxa-locale', JSON.stringify({ state: { locale }, version: 0 }))
  }

  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
  root.setAttribute('data-theme', theme)
  root.lang = locale
  root.dir = locale === 'ar' ? 'rtl' : 'ltr'
  root.setAttribute('data-locale', locale)
} catch {
  document.documentElement.classList.add('dark')
  document.documentElement.style.colorScheme = 'dark'
}
