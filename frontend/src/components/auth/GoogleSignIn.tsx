import { useEffect, useRef, useState } from 'react'
import { authApi } from '@/api/authApi'
import { getErrorMessage } from '@/api/client'
import { useT } from '@/hooks/useT'
import { useAuthStore } from '@/store/authStore'
import { useLocaleStore } from '@/store/localeStore'
import { useThemeStore } from '@/store/themeStore'
import type { User } from '@/types'

/** The Google Cloud OAuth client ID (Vercel variable VITE_GOOGLE_CLIENT_ID). Not set = no Google button. */
export const GOOGLE_CLIENT_ID = ((import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '').trim()

type GoogleId = {
  initialize: (o: Record<string, unknown>) => void
  renderButton: (el: HTMLElement, o: Record<string, unknown>) => void
  cancel: () => void
}
declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } }
  }
}

let gsiScript: Promise<GoogleId> | null = null
/** Google's sign-in script, loaded once, only on the sign-in pages */
function loadGoogle(): Promise<GoogleId> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id)
  gsiScript ??= new Promise<GoogleId>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => (window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error('gsi')))
    s.onerror = () => {
      gsiScript = null
      reject(new Error('gsi'))
    }
    document.head.appendChild(s)
  })
  return gsiScript
}

/**
 * "Continue with Google": Google's own button (it shows the visitor's Google account, so it is one
 * click when they are signed in to Google). Google hands us a signed token; the server checks it
 * and signs the customer in, making the account the first time (POST /auth/google).
 * Staff are refused there: they sign in with their password and code.
 */
export function GoogleSignIn({ onSignedIn }: { onSignedIn: (user: User) => void }) {
  if (!GOOGLE_CLIENT_ID) return null
  return <GoogleButton onSignedIn={onSignedIn} />
}

function GoogleButton({ onSignedIn }: { onSignedIn: (user: User) => void }) {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  const theme = useThemeStore((s) => s.theme)
  const setAuth = useAuthStore((s) => s.setAuth)
  const box = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // The latest handler, so Google's callback never uses an old one
  const done = useRef(onSignedIn)
  done.current = onSignedIn

  useEffect(() => {
    let gone = false
    loadGoogle()
      .then((gid) => {
        if (gone || !box.current) return
        gid.initialize({
          client_id: GOOGLE_CLIENT_ID,
          ux_mode: 'popup',
          auto_select: false,
          context: 'signin',
          itp_support: true,
          callback: async (r: { credential?: string }) => {
            if (!r.credential) return
            setError('')
            setBusy(true)
            try {
              const payload = (await authApi.google(r.credential)).data.data
              if (!payload?.user || !payload.accessToken) throw new Error(t('auth.googleFailed'))
              setAuth(payload.user, payload.accessToken)
              done.current(payload.user)
            } catch (err) {
              setError(getErrorMessage(err, t('auth.googleFailed')))
            } finally {
              setBusy(false)
            }
          },
        })
        box.current.replaceChildren()
        gid.renderButton(box.current, {
          type: 'standard',
          theme: theme === 'dark' ? 'filled_black' : 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          logo_alignment: 'center',
          width: Math.min(400, Math.max(200, box.current.clientWidth || 320)),
          locale,
        })
      })
      .catch(() => {
        if (!gone) setError(t('auth.googleUnavailable'))
      })
    return () => {
      gone = true
    }
  }, [locale, theme, setAuth, t])

  return (
    <div>
      <div ref={box} aria-busy={busy} className="flex min-h-[44px] w-full justify-center [color-scheme:normal]" />
      {error ? (
        <p role="alert" className="mt-2 text-center text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      <div className="mt-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]" aria-hidden="true">
        <span className="h-px flex-1 bg-[var(--border)]" />
        {t('auth.orDivider')}
        <span className="h-px flex-1 bg-[var(--border)]" />
      </div>
    </div>
  )
}
