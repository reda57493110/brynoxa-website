/**
 * After a deploy the previous version's code files no longer exist. A visitor who had the site
 * open then fails to load a page (or the French / Arabic texts) until they refresh. This reloads
 * the page once to pick up the new version; never twice within 30 s, so a real outage can't loop.
 */
const KEY = 'brynoxa-new-version-reload'

export function isChunkLoadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i.test(
    message
  )
}

/** Reloads the page unless it already did so in the last 30 s. True when a reload started. */
export function reloadForNewVersion() {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0)
    if (Date.now() - last < 30_000) return false
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    return false
  }
  window.location.reload()
  return true
}

export function watchForNewVersion() {
  // Vite's own signal: a file a page needs could not be preloaded
  window.addEventListener('vite:preloadError', (event) => {
    if (reloadForNewVersion()) event.preventDefault()
  })
  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkLoadError(event.reason)) reloadForNewVersion()
  })
}
