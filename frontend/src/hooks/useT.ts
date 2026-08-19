import { getMessages, translate, type MessageKey } from '@/i18n'
import { useLocaleStore } from '@/store/localeStore'

export function useT() {
  const locale = useLocaleStore((s) => s.locale)
  return (key: MessageKey, vars?: Record<string, string | number>) =>
    translate(locale, key, vars)
}

export function useMessages() {
  const locale = useLocaleStore((s) => s.locale)
  return getMessages(locale)
}
