import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/api/authApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuthStore } from '@/store/authStore'

export function Security() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const [setup, setSetup] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null)
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [code, setCode] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const run = async (action: () => Promise<void>) => {
    setLoading(true)
    setError('')
    setMessage('')
    try {
      await action()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold">Security</h1>
        <p className="text-sm text-[var(--fg-muted)]">
          Protect your staff account with an authenticator app.
        </p>
      </div>

      <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6">
        <div>
          <h2 className="font-display text-lg font-semibold">Authenticator-app MFA</h2>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            MFA is currently {user.mfaEnabled ? 'enabled' : 'disabled'} for this account.
          </p>
        </div>

        {!user.mfaEnabled && !setup ? (
          <Button
            onClick={() =>
              void run(async () => {
                setSetup((await authApi.setupMfa()).data.data)
              })
            }
            loading={loading}
          >
            Start MFA setup
          </Button>
        ) : null}

        {setup && !user.mfaEnabled ? (
          <div className="space-y-4">
            <img
              src={setup.qrCodeDataUrl}
              alt="Scan this QR code with your authenticator app"
              className="h-48 w-48 rounded-xl border border-[var(--border)] bg-white p-2"
            />
            <p className="text-sm text-[var(--fg-muted)]">
              If you cannot scan the QR code, enter this key manually:
            </p>
            <code className="block break-all rounded-xl bg-[var(--bg-muted)] p-3 text-sm">
              {setup.secret}
            </code>
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault()
                void run(async () => {
                  const result = await authApi.verifyMfaSetup(code.trim())
                  setRecoveryCodes(result.data.data.recoveryCodes)
                  setSetup(null)
                  setCode('')
                  setUser({ ...user, mfaEnabled: true })
                })
              }}
            >
              <Input
                label="Authenticator code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                required
              />
              <Button type="submit" loading={loading}>
                Verify and enable MFA
              </Button>
            </form>
          </div>
        ) : null}

        {recoveryCodes.length ? (
          <div className="space-y-3 rounded-xl border border-[var(--brand)]/40 bg-[var(--brand)]/5 p-4">
            <h3 className="font-semibold">Save your recovery codes</h3>
            <p className="text-sm text-[var(--fg-muted)]">
              Each code works once. This list will not be shown again.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {recoveryCodes.map((recoveryCode) => (
                <code key={recoveryCode} className="rounded bg-[var(--bg-muted)] p-2 text-center">
                  {recoveryCode}
                </code>
              ))}
            </div>
            <Button variant="outline" onClick={() => setRecoveryCodes([])}>
              I saved them
            </Button>
          </div>
        ) : null}

        {user.mfaEnabled ? (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault()
              void run(async () => {
                await authApi.disableMfa(code.trim())
                setCode('')
                setUser({ ...user, mfaEnabled: false })
                setMessage('MFA disabled')
              })
            }}
          >
            <Input
              label="Current authenticator code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              required
            />
            <Button type="submit" variant="danger" loading={loading}>
              Disable MFA
            </Button>
          </form>
        ) : null}

        {error ? <p className="text-sm text-[var(--danger)]" role="alert">{error}</p> : null}
        {message ? <p className="text-sm text-[var(--success)]" role="status">{message}</p> : null}
      </section>

      <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6">
        <div>
          <h2 className="font-display text-lg font-semibold">Change password</h2>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            Changing your password signs out all current sessions.
          </p>
        </div>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (newPassword !== confirmPassword) {
              setError('New passwords do not match')
              return
            }
            void run(async () => {
              await authApi.changePassword({ currentPassword, newPassword })
              logout()
              navigate('/login', { replace: true })
            })
          }}
        >
          <Input
            label="Current password"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
          <Input
            label="New password"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            minLength={12}
            required
          />
          <Input
            label="Confirm new password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            minLength={12}
            required
          />
          <Button type="submit" loading={loading}>
            Change password
          </Button>
        </form>
      </section>
    </div>
  )
}
