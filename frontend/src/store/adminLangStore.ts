import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { adminText, setCurrentAdminLang, type AdminKey, type AdminLang } from '@/i18n/admin'

interface AdminLangState {
  lang: AdminLang
  setLang: (lang: AdminLang) => void
}

/** The language of the admin (separate from the shop's: staff choose their own, kept on this device) */
export const useAdminLangStore = create<AdminLangState>()(
  persist(
    (set) => ({
      lang: 'en',
      setLang: (lang) => set({ lang }),
    }),
    { name: 'brynoxa-admin-lang' }
  )
)

// Plain functions (status labels…) read the language from i18n/admin: keep it in step
setCurrentAdminLang(useAdminLangStore.getState().lang)
useAdminLangStore.subscribe((s) => setCurrentAdminLang(s.lang))

/** Admin texts in the chosen language: const a = useAdminT(); a('nav.orders') */
export function useAdminT() {
  const lang = useAdminLangStore((s) => s.lang)
  return (key: AdminKey, vars?: Record<string, string | number>) => adminText(lang, key, vars)
}
