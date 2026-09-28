import { useCallback, useEffect, useState } from 'react'
import {
  PUSH_STATUS_EVENT,
  announcePushStatus,
  dismissPushPrompt,
  getPushStatus,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
  type PushStatus,
} from '@/lib/push'
import type { PushOrderLink } from '@/api/pushApi'
import { useLocaleStore } from '@/store/localeStore'
import { toast } from '@/store/toastStore'
import { useT } from '@/hooks/useT'

export function usePush() {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  const [status, setStatus] = useState<PushStatus>(() =>
    isPushSupported() ? 'available' : 'unsupported'
  )
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    const refresh = () => {
      getPushStatus()
        .then((next) => {
          if (!active) return
          setStatus(next)
          setReady(true)
        })
        .catch(() => undefined)
    }
    refresh()
    window.addEventListener(PUSH_STATUS_EVENT, refresh)
    return () => {
      active = false
      window.removeEventListener(PUSH_STATUS_EVENT, refresh)
    }
  }, [])

  const enable = useCallback(async (order?: PushOrderLink) => {
    setBusy(true)
    try {
      const next = await subscribeToPush(locale, order)
      if (next === 'subscribed') toast.success(t('push.enabled'))
      else if (next === 'denied') toast.info(t('push.blocked'))
      else dismissPushPrompt()
      return next
    } catch {
      dismissPushPrompt()
      toast.error(t('push.failed'))
      return 'available' as const
    } finally {
      setBusy(false)
      announcePushStatus()
    }
  }, [locale, t])

  const disable = useCallback(async () => {
    setBusy(true)
    try {
      await unsubscribeFromPush()
      toast.info(t('push.disabled'))
    } finally {
      setBusy(false)
      announcePushStatus()
    }
  }, [t])

  return { status, ready, busy, enable, disable }
}
