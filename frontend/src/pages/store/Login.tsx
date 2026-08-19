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

export function Login() {
  const t = useT()
  usePageTitle(t('auth.titleSignIn'))
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from || '/account'
  const setAuth = useAuthStore((s) => s.setAuth)
  const localIds = useWishlistStore((s) => s.ids)
  const setFromServer = useWishlistStore((s) => s.setFromServer)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await authApi.login({ email, password })
      setAuth(res.data.data.user, res.data.data.accessToken)
      try {
        if (localIds.length) {
          setFromServer((await wishlistApi.sync(localIds)).data.data)
        } else {
          setFromServer((await wishlistApi.list()).data.data)
        }
      } catch {
        /* ignore */
      }
      toast.success(t('auth.welcomeBack'))
      const user = res.data.data.user
      const dest =
        user.role === 'admin'
          ? from.startsWith('/admin')
            ? from
            : '/admin'
          : from.startsWith('/admin')
            ? '/account'
            : from
      navigate(dest, { replace: true })
    } catch (err) {
      toast.error(getErrorMessage(err, t('auth.loginFailed')))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <p className="kicker">{t('auth.kicker')}</p>
      <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">{t('auth.signInTitle')}</h1>
      <p className="mt-1 text-sm text-[var(--fg-muted)]">{t('auth.signInBody')}</p>
      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <Input
          label={t('ui.email')}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <Input
          label={t('ui.password')}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
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
