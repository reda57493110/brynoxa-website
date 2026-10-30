import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { isLocale, loadLocale, LOCALES, type Locale } from '@/i18n'
import { currentPathLocale } from '@/lib/localePath'

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
      locale: currentPathLocale(),
      setLocale: (locale) => {
        // Switch once the language file is here, so the page never shows missing text
        void loadLocale(locale)
          .catch(() => undefined)
          .then(() => {
            applyLocale(locale)
            set({ locale })
          })
      },
      hydrateLocale: () => {
        applyLocale(useLocaleStore.getState().locale)
      },
    }),
    {
      name: 'brynoxa-locale',
      // The address decides the language (/fr/…, /ar/…): a language saved from an earlier visit
      // never overrides it (this store can load before themeInit.ts has saved the new one)
      merge: (saved, current) => ({ ...current, ...(saved as Partial<LocaleState>), locale: currentPathLocale() }),
      onRehydrateStorage: () => (state) => {
        if (state && isLocale(state.locale)) applyLocale(state.locale)
      },
    }
  )
)
