import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '@/api/authApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useT } from '@/hooks/useT'

export function ResetPassword() {
  const t = useT()
  usePageTitle(`${t('auth.resetPassword')} — Brynoxa`)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  // The reset key is read once and removed from the address (history, analytics, screenshots).
  // After the emailed code was typed (Forgot password), it comes in the page state instead.
  const location = useLocation()
  const [token] = useState(() => params.get('token') || (location.state as { resetToken?: string } | null)?.resetToken || '')
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('token')) window.history.replaceState(window.history.state, '', window.location.pathname)
    else if ((location.state as { resetToken?: string } | null)?.resetToken) window.history.replaceState({ ...window.history.state, usr: null }, '', window.location.pathname)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (password.length < 6 || password !== confirmPassword) {
      setError(t('account.passwordMismatch'))
      return
    }
    setLoading(true)
    setError('')
    try {
      await authApi.resetPassword({ token, newPassword: password })
      navigate('/login', { replace: true })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <p className="kicker">{t('auth.resetPassword')}</p>
      <h1 className="mt-2 font-display text-2xl font-semibold">{t('auth.resetPassword')}</h1>
      <form className="mt-6 space-y-4" onSubmit={submit}>
        <Input
          label={t('account.newPassword')}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          minLength={6}
          required
        />
        <Input
          label={t('account.confirmPassword')}
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          minLength={6}
          required
        />
        {error ? <p className="text-sm text-[var(--danger)]" role="alert">{error}</p> : null}
        <Button type="submit" className="w-full rounded-full" loading={loading}>
          {t('auth.resetPassword')}
        </Button>
      </form>
      <Link to="/login" className="mt-5 block text-center text-sm text-[var(--brand-text)]">
        {t('auth.mfaBack')}
      </Link>
    </div>
  )
}
