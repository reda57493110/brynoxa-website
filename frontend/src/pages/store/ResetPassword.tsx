import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '@/api/authApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useT } from '@/hooks/useT'

export function ResetPassword() {
  const t = useT()
  usePageTitle(t('auth.resetPassword'))
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (password.length < 12 || password !== confirmPassword) {
      setError(t('account.passwordMismatch'))
      return
    }
    setLoading(true)
    setError('')
    try {
      await authApi.resetPassword({ token: params.get('token') || '', newPassword: password })
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
          minLength={12}
          required
        />
        <Input
          label={t('account.confirmPassword')}
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          minLength={12}
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
