import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { isLocale, LOCALES, type Locale } from '@/i18n'

interface LocaleState {
  locale: Locale
  setLocale: (locale: Locale) => void
  hydrateLocale: () => void
}

export function applyLocale(locale: Locale) {
  const meta = LOCALES.find((item) => item.id === locale) ?? LOCALES[0]
  const root = document.documentElement
  root.lang = locale
  root.dir = meta.dir
  root.setAttribute('data-locale', locale)
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: 'en',
      setLocale: (locale) => {
        applyLocale(locale)
        set({ locale })
      },
      hydrateLocale: () => {
        applyLocale(useLocaleStore.getState().locale)
      },
    }),
    {
      name: 'brynoxa-locale',
      onRehydrateStorage: () => (state) => {
        if (state && isLocale(state.locale)) applyLocale(state.locale)
      },
    }
  )
)
