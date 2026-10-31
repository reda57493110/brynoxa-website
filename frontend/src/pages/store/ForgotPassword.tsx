import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { authApi } from '@/api/authApi'
import { settingsApi } from '@/api/settingsApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useT } from '@/hooks/useT'
import { CONTACT } from '@/lib/site'

export function ForgotPassword() {
  const t = useT()
  usePageTitle(`${t('auth.resetPassword')} — Brynoxa`, { noIndex: true })
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // Step 2: the 6-digit code from the email
  const navigate = useNavigate()
  const [sentTo, setSentTo] = useState('')
  const [code, setCode] = useState('')

  // When the shop cannot send emails, a reset link would never arrive: offer WhatsApp instead
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await settingsApi.get()).data.data,
    staleTime: 60_000,
  })
  const emailOff = settings.data?.emailEnabled === false
  const whatsappHref = `${CONTACT.whatsapp.href}?text=${encodeURIComponent(
    t('auth.resetWhatsAppMessage', { email: email.trim() || '—' })
  )}`

  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    setLoading(true)
    setError('')
    try {
      await authApi.requestPasswordReset(email.trim())
      setMessage(sentTo ? t('auth.resetCodeResent') : '')
      setSentTo(email.trim())
      setCode('')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const checkCode = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const { token } = (await authApi.verifyResetCode(sentTo, code)).data.data
      navigate('/reset-password', { replace: true, state: { resetToken: token } })
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
      {emailOff ? (
        <div className="mt-4 space-y-4">
          <p className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] px-4 py-3 text-sm leading-relaxed">
            {t('auth.resetByWhatsApp')}
          </p>
          <Input
            label={t('ui.email')}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-5 text-sm font-semibold text-[var(--brand-fg)] transition hover:brightness-110"
          >
            <SiteIcon name="chat" size={16} />
            {t('auth.resetWhatsAppButton')}
          </a>
        </div>
      ) : sentTo ? (
        <>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">{t('auth.resetEmailSent', { email: sentTo })}</p>
          <form className="mt-6 space-y-4" onSubmit={checkCode}>
            <Input
              label={t('auth.resetCodeLabel')}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              dir="ltr"
              className="text-center font-mono text-xl tracking-[0.5em]"
              autoFocus
              required
            />
            {message ? <p className="text-sm text-[var(--success)]" role="status">{message}</p> : null}
            {error ? <p className="text-sm text-[var(--danger)]" role="alert">{error}</p> : null}
            <Button type="submit" className="w-full rounded-full" loading={loading} disabled={code.length !== 6}>
              {t('auth.resetCodeContinue')}
            </Button>
          </form>
          <p className="mt-4 text-xs leading-relaxed text-[var(--fg-muted)]">{t('auth.resetCodeHint')}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
            <button type="button" className="text-[var(--brand-text)] disabled:opacity-50" disabled={loading} onClick={() => submit()}>
              {t('auth.resetCodeResend')}
            </button>
            <button
              type="button"
              className="text-[var(--fg-muted)] hover:text-[var(--fg)]"
              onClick={() => {
                setSentTo('')
                setCode('')
                setError('')
                setMessage('')
              }}
            >
              {t('auth.resetCodeOtherEmail')}
            </button>
          </div>
        </>
      ) : (
        <>
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
        </>
      )}
      <Link to="/login" className="mt-5 block text-center text-sm text-[var(--brand-text)]">
        {t('auth.mfaBack')}
      </Link>
    </div>
  )
}
