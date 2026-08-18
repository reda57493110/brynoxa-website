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

export function Register() {
  usePageTitle('Create account — Brynoxa')
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const localIds = useWishlistStore((s) => s.ids)
  const setFromServer = useWishlistStore((s) => s.setFromServer)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await authApi.register({ name, email, password, phone: phone || undefined })
      setAuth(res.data.data.user, res.data.data.accessToken)
      try {
        if (localIds.length) {
          setFromServer((await wishlistApi.sync(localIds)).data.data)
        }
      } catch {
        /* ignore */
      }
      toast.success('Account created')
      navigate('/account', { replace: true })
    } catch (err) {
      toast.error(getErrorMessage(err, 'Registration failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <p className="kicker">Account</p>
      <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">Create account</h1>
      <p className="mt-1 text-sm text-[var(--fg-muted)]">Track orders and pay on delivery.</p>
      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        <Button type="submit" className="w-full rounded-full" loading={loading}>
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-[var(--fg-muted)]">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-[var(--brand-text)]">
          Sign in
        </Link>
      </p>
    </div>
  )
}
