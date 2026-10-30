import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './themeInit'
import './index.css'
import App from './App'
import { isLocale, loadLocale } from './i18n'
import { isChunkLoadError, reloadForNewVersion, watchForNewVersion } from './lib/newVersion'

watchForNewVersion()

/** Load the saved language (French / Arabic) before the first render, so there is no English flash. */
async function savedLocale() {
  try {
    const raw = localStorage.getItem('brynoxa-locale')
    const locale = raw ? (JSON.parse(raw) as { state?: { locale?: string } }).state?.locale : undefined
    if (isLocale(locale) && locale !== 'en') await loadLocale(locale)
  } catch (error) {
    // Old version after a deploy: reload for the new one instead of showing the page in English
    if (isChunkLoadError(error) && reloadForNewVersion()) return false
    /* offline or storage blocked: English until the language loads */
  }
  return true
}

void savedLocale().then((render) => {
  if (!render) return
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
})
