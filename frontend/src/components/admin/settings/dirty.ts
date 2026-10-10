import { createContext, useContext, useEffect } from 'react'

/** Sections report unsaved changes here, so the Settings page can warn before switching or leaving. */
export const DirtyContext = createContext<(key: string, dirty: boolean) => void>(() => {})

export function useReportDirty(key: string, dirty: boolean) {
  const report = useContext(DirtyContext)
  useEffect(() => {
    report(key, dirty)
    return () => report(key, false)
  }, [key, dirty, report])
}
