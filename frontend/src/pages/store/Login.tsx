import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
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

import { isStaffRole, staffHomePath } from '@/lib/permissions'

function resolvePostLoginPath(role: string, from?: string) {
  if (isStaffRole(role)) {
    if (from?.startsWith('/admin')) return from
    return staffHomePath(role)
  }
  if (from && from !== '/login' && from !== '/register' && !from.startsWith('/admin')) {
    return from
  }
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
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState('')

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError('')

    const trimmedEmail = email.trim()
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setFormError(t('auth.emailInvalid'))
      return
    }
    if (!password) {
      setFormError(t('auth.passwordRequired'))
      return
    }

    setLoading(true)
    try {
      const res = await authApi.login({ email: trimmedEmail, password })
      const payload = res.data?.data
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
      setFormError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <p className="kicker">{t('auth.kicker')}</p>
      <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">{t('auth.signInTitle')}</h1>
      <p className="mt-1 text-sm text-[var(--fg-muted)]">{t('auth.signInBody')}</p>
      <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
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
        {formError ? (
          <p
            className="rounded-xl border border-[var(--danger)]/40 bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] px-3.5 py-2.5 text-sm text-[var(--danger)]"
            role="alert"
          >
            {formError}
          </p>
        ) : null}
        <Button type="submit" className="w-full rounded-full" loading={loading}>
          {t('common.signIn')}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-[var(--fg-muted)]">
        {t('auth.noAccount')}{' '}
        <Link to="/register" className="font-medium text-[var(--brand-text)]">
          {t('auth.createAccount')}
        </Link>
      </p>
    </div>
  )
}
