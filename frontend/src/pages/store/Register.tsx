import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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

export function Register() {
  const t = useT()
  usePageTitle(t('auth.titleRegister'))
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const localIds = useWishlistStore((s) => s.ids)
  const setFromServer = useWishlistStore((s) => s.setFromServer)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState('')

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError('')

    const trimmedName = name.trim()
    const trimmedEmail = email.trim()
    const trimmedPhone = phone.trim()

    if (trimmedName.length < 2) {
      setFormError(t('auth.nameTooShort'))
      return
    }
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setFormError(t('auth.emailInvalid'))
      return
    }
    if (password.length < 6) {
      setFormError(t('auth.passwordTooShort'))
      return
    }

    setLoading(true)
    try {
      const res = await authApi.register({
        name: trimmedName,
        email: trimmedEmail,
        password,
        phone: trimmedPhone || undefined,
      })
      const payload = res.data?.data
      if (!payload?.user || !payload.accessToken) {
        throw new Error(t('auth.registerFailed'))
      }
      setAuth(payload.user, payload.accessToken)
      toast.success(t('auth.registerSuccess'))
      navigate('/', { replace: true })

      if (localIds.length) {
        void wishlistApi
          .sync(localIds)
          .then((r) => setFromServer(r.data.data))
          .catch(() => {
            /* ignore */
          })
      }
    } catch (err) {
      const message = getErrorMessage(err, t('auth.registerFailed'))
      setFormError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <p className="kicker">{t('auth.kicker')}</p>
      <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">{t('auth.registerTitle')}</h1>
      <p className="mt-1 text-sm text-[var(--fg-muted)]">{t('auth.registerBody')}</p>
      <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
        <Input
          label={t('ui.name')}
          name="name"
          autoComplete="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            if (formError) setFormError('')
          }}
          required
        />
        <Input
          label={t('ui.email')}
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (formError) setFormError('')
          }}
          required
        />
        <Input
          label={t('ui.phone')}
          name="phone"
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Input
          label={t('ui.password')}
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            if (formError) setFormError('')
          }}
          required
          minLength={6}
        />
        {formError ? (
          <p className="rounded-xl border border-[var(--danger)]/40 bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] px-3.5 py-2.5 text-sm text-[var(--danger)]" role="alert">
            {formError}
          </p>
        ) : null}
        <Button type="submit" className="w-full rounded-full" loading={loading}>
          {t('auth.createAccount')}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-[var(--fg-muted)]">
        {t('auth.hasAccount')}{' '}
        <Link to="/login" className="font-medium text-[var(--brand-text)]">
          {t('common.signIn')}
        </Link>
      </p>
    </div>
  )
}
