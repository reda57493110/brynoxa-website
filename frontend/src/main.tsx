import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './themeInit'
import './index.css'
import App from './App'
import { loadLocale } from './i18n'
import { currentPathLocale } from './lib/localePath'
import { isChunkLoadError, reloadForNewVersion, watchForNewVersion } from './lib/newVersion'

watchForNewVersion()

/** Load the page's language (French / Arabic) before the first render, so there is no English flash. */
async function savedLocale() {
  try {
    // The language of the address (/fr/…, /ar/…), as everywhere else
    const locale = currentPathLocale()
    if (locale !== 'en') await loadLocale(locale)
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
