import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Tracks whether the image inside `ref` has finished loading (or failed).
 * Spread `onLoad`/`onError` on the image and put `ref` on its frame.
 *
 * The image's own `complete` flag is checked and native listeners are attached in the same
 * synchronous step, so a load that finishes before (or while) React wires up `onLoad` can never
 * leave the photo hidden behind a spinner.
 */
export function useImageLoaded<T extends HTMLElement = HTMLDivElement>(src?: string) {
  const ref = useRef<T>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const img = ref.current?.querySelector('img')
    // No <img> (missing photo or fallback shown): nothing to wait for
    if (!img || !src) {
      setLoaded(true)
      return
    }
    if (img.complete) {
      setLoaded(true)
      return
    }
    setLoaded(false)
    const done = () => setLoaded(true)
    img.addEventListener('load', done)
    img.addEventListener('error', done)
    return () => {
      img.removeEventListener('load', done)
      img.removeEventListener('error', done)
    }
  }, [src])

  const done = useCallback(() => setLoaded(true), [])
  return { ref, loaded, onLoad: done, onError: done }
}
