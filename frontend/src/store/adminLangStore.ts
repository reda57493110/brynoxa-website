import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { adminText, type AdminKey, type AdminLang } from '@/i18n/admin'

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

/** Admin texts in the chosen language: const a = useAdminT(); a('nav.orders') */
export function useAdminT() {
  const lang = useAdminLangStore((s) => s.lang)
  return (key: AdminKey, vars?: Record<string, string | number>) => adminText(lang, key, vars)
}
