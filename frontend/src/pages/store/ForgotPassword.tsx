import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '@/api/authApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useT } from '@/hooks/useT'

export function ForgotPassword() {
  const t = useT()
  usePageTitle(t('auth.resetPassword'))
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      await authApi.requestPasswordReset(email.trim())
      setMessage(t('auth.resetEmailSent'))
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <p className="kicker">{t('auth.resetPassword')}</p>
      <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">
        {t('auth.resetPassword')}
      </h1>
      <p className="mt-1 text-sm text-[var(--fg-muted)]">{t('auth.resetPasswordBody')}</p>
      <form className="mt-6 space-y-4" onSubmit={submit}>
        <Input
          label={t('ui.email')}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />
        {message ? <p className="text-sm text-[var(--success)]" role="status">{message}</p> : null}
        {error ? <p className="text-sm text-[var(--danger)]" role="alert">{error}</p> : null}
        <Button type="submit" className="w-full rounded-full" loading={loading}>
          {t('auth.sendResetLink')}
        </Button>
      </form>
      <Link to="/login" className="mt-5 block text-center text-sm text-[var(--brand-text)]">
        {t('auth.mfaBack')}
      </Link>
    </div>
  )
}
