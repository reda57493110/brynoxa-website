import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'

/**
 * A copy of some admin figures kept on this device, so a page can show the last numbers at once
 * while fresh ones load (most useful on phones, where every request takes longer). Each copy
 * belongs to one signed-in account and is wiped on sign-out or when someone else signs in
 * (clearSavedCopies, called from app/providers.tsx). Never use it for anything a customer sees.
 */
const PREFIX = 'brynoxa-saved:'
const MAX_AGE_MS = 7 * 24 * 60 * 60_000

const keyFor = (userId: string, key: string) => `${PREFIX}${userId}:${key}`

export function readSavedCopy<T>(userId: string | undefined, key: string): T | undefined {
  if (!userId) return undefined
  try {
    const raw = localStorage.getItem(keyFor(userId, key))
    if (!raw) return undefined
    const { at, data } = JSON.parse(raw) as { at: number; data: T }
    return Date.now() - at < MAX_AGE_MS ? data : undefined
  } catch {
    return undefined
  }
}

export function writeSavedCopy(userId: string | undefined, key: string, data: unknown) {
  if (!userId || data === undefined) return
  try {
    localStorage.setItem(keyFor(userId, key), JSON.stringify({ at: Date.now(), data }))
  } catch {
    /* storage full or private mode: the page simply loads as before */
  }
}

/** Removes every saved copy except those of `keepUserId` (none when signed out). */
export function clearSavedCopies(keepUserId?: string | null) {
  try {
    const keep = keepUserId ? `${PREFIX}${keepUserId}:` : null
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (k?.startsWith(PREFIX) && (!keep || !k.startsWith(keep))) localStorage.removeItem(k)
    }
  } catch {
    /* nothing to clear */
  }
}

/**
 * For a React Query `placeholderData`: while loading, the previous data (e.g. another period) or
 * else the saved copy. Pair with useKeepSavedCopy so the copy follows the fresh data.
 */
export const savedPlaceholder =
  <T,>(key: string) =>
  (previous: T | undefined): T | undefined =>
    previous ?? readSavedCopy<T>(useAuthStore.getState().user?._id, key)

/** Saves fresh (not placeholder) data as the copy for next time. */
export function useKeepSavedCopy(key: string, data: unknown, isPlaceholder: boolean) {
  const userId = useAuthStore((s) => s.user?._id)
  useEffect(() => {
    if (!isPlaceholder) writeSavedCopy(userId, key, data)
  }, [userId, key, data, isPlaceholder])
}
