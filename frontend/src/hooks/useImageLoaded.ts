import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Tracks whether the image inside `ref` has finished loading (or failed).
 * Spread `onLoad`/`onError` on the image and put `ref` on its frame.
 */
export function useImageLoaded<T extends HTMLElement = HTMLDivElement>(src?: string) {
  const ref = useRef<T>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLoaded(Boolean(ref.current?.querySelector('img')?.complete))
  }, [src])

  const done = useCallback(() => setLoaded(true), [])
  return { ref, loaded, onLoad: done, onError: done }
}
