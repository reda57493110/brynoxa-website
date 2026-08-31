try {
  const storedTheme = localStorage.getItem('brynoxa-theme')
  const theme = storedTheme ? JSON.parse(storedTheme)?.state?.theme : 'dark'
  const storedLocale = localStorage.getItem('brynoxa-locale')
  const locale = storedLocale ? JSON.parse(storedLocale)?.state?.locale : 'en'
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
