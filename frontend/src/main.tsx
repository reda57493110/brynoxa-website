import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './themeInit'
import './index.css'
import App from './App'
import { isLocale, loadLocale } from './i18n'

/** Load the saved language (French / Arabic) before the first render, so there is no English flash. */
async function savedLocale() {
  try {
    const raw = localStorage.getItem('brynoxa-locale')
    const locale = raw ? (JSON.parse(raw) as { state?: { locale?: string } }).state?.locale : undefined
    if (isLocale(locale) && locale !== 'en') await loadLocale(locale)
  } catch {
    /* offline or storage blocked: English until the language loads */
  }
}

void savedLocale().then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
)
