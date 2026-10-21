import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import { authApi } from '@/api/authApi'
import { wishlistApi } from '@/api/wishlistApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuthStore } from '@/store/authStore'
import { useWishlistStore } from '@/store/wishlistStore'
import { toast } from '@/store/toastStore'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useT } from '@/hooks/useT'

import { isStaffRole } from '@/lib/permissions'
import { SiteIcon } from '@/components/ui/SiteIcon'
import type { AuthLayoutContext } from '@/app/layouts/AuthLayout'

function resolvePostLoginPath(role: string, from?: string) {
  if (from?.startsWith('/admin')) return isStaffRole(role) ? from : '/'
  if (from && from !== '/login' && from !== '/register') return from
  return '/'
}

export function Login() {
  const t = useT()
  usePageTitle(t('auth.titleSignIn'))
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  const setAuth = useAuthStore((s) => s.setAuth)
  const localIds = useWishlistStore((s) => s.ids)
  const setFromServer = useWishlistStore((s) => s.setFromServer)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mfaToken, setMfaToken] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState('')
  // No shop slogan under the security check
  const layout = useOutletContext<AuthLayoutContext | undefined>()
  useEffect(() => {
    layout?.setHideHint(Boolean(mfaToken))
    return () => layout?.setHideHint(false)
  }, [mfaToken, layout])

  const onSubmit = async (e?: FormEvent, codeNow?: string) => {
    e?.preventDefault()
    if (loading) return
    setFormError('')
    const code = (codeNow ?? mfaCode).trim()

    const trimmedEmail = email.trim()
    if (mfaToken) {
      if (!/^\d{6}$/.test(code)) {
        setFormError(t('auth.mfaCodeRequired'))
        return
      }
    } else {
      if (!trimmedEmail || !trimmedEmail.includes('@')) {
        setFormError(t('auth.emailInvalid'))
        return
      }
      if (!password) {
        setFormError(t('auth.passwordRequired'))
        return
      }
    }

    setLoading(true)
    try {
      const res = mfaToken
        ? await authApi.completeMfaLogin({ mfaToken, code })
        : await authApi.login({ email: trimmedEmail, password })
      const payload = res.data?.data
      if (!mfaToken && payload?.mfaRequired && payload.mfaToken) {
        setMfaToken(payload.mfaToken)
        return
      }
      if (!payload?.user || !payload.accessToken) {
        throw new Error(t('auth.loginFailed'))
      }

      setAuth(payload.user, payload.accessToken)
      toast.success(t('auth.welcomeBack'))
      navigate(resolvePostLoginPath(payload.user.role, from), { replace: true })

      void (async () => {
        try {
          if (localIds.length) {
            setFromServer((await wishlistApi.sync(localIds)).data.data)
          } else {
            setFromServer((await wishlistApi.list()).data.data)
          }
        } catch {
          /* ignore */
        }
      })()
    } catch (err) {
      const message = getErrorMessage(err, t('auth.loginFailed'))
      const serverBusy =
        message.includes('timed out') || message.includes('Cannot reach the server')
      setFormError(serverBusy ? 'Server is starting — wait 15 seconds and try again.' : message)
      // Wrong code: empty the box so the next code can be typed straight away
      if (mfaToken) setMfaCode('')
      toast.error(serverBusy ? 'Server is starting — wait 15 seconds and try again.' : message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {mfaToken ? (
        <div className="flex flex-col items-center text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] text-[var(--brand-text)]">
            <SiteIcon name="shield" size={22} />
          </span>
          <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight">{t('auth.mfaTitle')}</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">{t('auth.mfaBody')}</p>
          {email.trim() ? <p className="mt-2 rounded-full bg-[var(--bg-muted)] px-3 py-1 text-xs font-medium">{email.trim()}</p> : null}
        </div>
      ) : (
        <>
          <p className="kicker">{t('auth.kicker')}</p>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">{t('auth.signInTitle')}</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">{t('auth.signInBody')}</p>
        </>
      )}
      <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
        {mfaToken ? (
          <div>
            <label htmlFor="mfaCode" className="sr-only">
              {t('auth.mfaCode')}
            </label>
            <input
              id="mfaCode"
              name="mfaCode"
              value={mfaCode}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 6)
                setMfaCode(digits)
                if (formError) setFormError('')
                // Signs in on its own once the 6th digit is typed
                if (digits.length === 6) void onSubmit(undefined, digits)
              }}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoComplete="one-time-code"
              autoFocus
              placeholder="••••••"
              aria-describedby="mfa-hint"
              className="h-16 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg)] text-center font-mono text-3xl tracking-[0.5em] outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--brand)_30%,transparent)]"
              dir="ltr"
            />
            <p id="mfa-hint" className="mt-2 text-center text-xs text-[var(--fg-muted)]">
              {t('auth.mfaHint')}
            </p>
          </div>
        ) : (
          <>
            <Input
              label={t('ui.email')}
              name="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (formError) setFormError('')
              }}
              required
              autoComplete="email"
            />
            <Input
              label={t('ui.password')}
              name="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (formError) setFormError('')
              }}
              required
              autoComplete="current-password"
            />
          </>
        )}
        {formError ? (
          <p
            className="rounded-xl border border-[var(--danger)]/40 bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] px-3.5 py-2.5 text-sm text-[var(--danger)]"
            role="alert"
          >
            {formError}
          </p>
        ) : null}
        <Button type="submit" className="w-full rounded-full" loading={loading}>
          {mfaToken ? t('auth.mfaVerify') : t('common.signIn')}
        </Button>
        {mfaToken ? (
          <button
            type="button"
            className="w-full text-sm text-[var(--brand-text)]"
            onClick={() => {
              setMfaToken('')
              setMfaCode('')
              setFormError('')
            }}
          >
            {t('auth.mfaBack')}
          </button>
        ) : null}
      </form>
      {!mfaToken ? (
        <Link to="/forgot-password" className="mt-4 block text-center text-sm text-[var(--brand-text)]">
          {t('auth.forgotPassword')}
        </Link>
      ) : null}
      {!mfaToken ? <p className="mt-6 text-center text-sm text-[var(--fg-muted)]">
        {t('auth.noAccount')}{' '}
        <Link to="/register" className="font-medium text-[var(--brand-text)]">
          {t('auth.createAccount')}
        </Link>
      </p> : null}
    </div>
  )
}
