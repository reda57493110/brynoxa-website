import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authApi } from '@/api/authApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useT } from '@/hooks/useT'

export function VerifyEmail() {
  const t = useT()
  usePageTitle(t('auth.verifyEmail'))
  const [params] = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    const token = params.get('token') || ''
    if (!token) {
      setError(t('auth.loginFailed'))
      setStatus('error')
      return
    }
    void authApi
      .verifyEmail(token)
      .then(() => setStatus('success'))
      .catch((err) => {
        setError(getErrorMessage(err))
        setStatus('error')
      })
  }, [params, t])

  return (
    <div className="text-center">
      <p className="kicker">{t('auth.verifyEmail')}</p>
      {status === 'loading' ? <p className="mt-4 text-sm text-[var(--fg-muted)]">…</p> : null}
      {status === 'success' ? (
        <>
          <h1 className="mt-2 font-display text-2xl font-semibold">{t('auth.verificationSuccess')}</h1>
          <Link to="/login" className="mt-6 inline-block">
            <Button>{t('common.signIn')}</Button>
          </Link>
        </>
      ) : null}
      {status === 'error' ? (
        <>
          <p className="mt-4 text-sm text-[var(--danger)]" role="alert">{error}</p>
          <Link to="/login" className="mt-6 inline-block">
            <Button variant="outline">{t('auth.mfaBack')}</Button>
          </Link>
        </>
      ) : null}
    </div>
  )
}
