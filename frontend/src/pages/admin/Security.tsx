import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/api/authApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { Panel } from '@/components/admin/Panel'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/store/toastStore'

const MIN_PASSWORD = 12

/** Runs one action with its own busy / error state, so each form reports its own result. */
function useAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, setError, run }
}

function TwoStepPanel() {
  const user = useAuthStore((s) => s.user)!
  const setUser = useAuthStore((s) => s.setUser)
  const [setup, setSetup] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null)
  const [code, setCode] = useState('')
  const { busy, error, run } = useAction()

  const startSetup = (rotate = false) =>
    run(async () => {
      setCode('')
      setSetup((await authApi.setupMfa(rotate)).data.data)
    })


  return (
    <Panel
      title="Two-step sign-in"
      description="A 6-digit code from an authenticator app is asked at every sign-in."
      actions={<Badge variant={user.mfaEnabled ? 'success' : 'warning'}>{user.mfaEnabled ? 'On' : 'Off'}</Badge>}
    >
      {!user.mfaEnabled && !setup ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void startSetup()} loading={busy}>
            Set up two-step sign-in
          </Button>
          <p className="text-xs text-[var(--fg-muted)]">Works with Google Authenticator, Microsoft Authenticator, 1Password…</p>
        </div>
      ) : null}

      {setup && !user.mfaEnabled ? (
        <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
          <img
            src={setup.qrCodeDataUrl}
            alt="QR code for your authenticator app"
            className="h-44 w-44 rounded-xl border border-[var(--border)] bg-white p-2"
          />
          <div className="min-w-0 space-y-3">
            <ol className="list-decimal space-y-1 ps-5 text-sm text-[var(--fg-muted)]">
              <li>Remove any old Brynoxa entry from your app.</li>
              <li>Scan the QR code, or enter the key below.</li>
              <li>Type the 6-digit code your app shows right now.</li>
            </ol>
            <code className="block break-all rounded-lg bg-[var(--bg-muted)] px-3 py-2 text-xs">{setup.secret}</code>
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault()
                void run(async () => {
                  await authApi.verifyMfaSetup(code.trim(), setup.secret)
                  setSetup(null)
                  setCode('')
                  setUser({ ...user, mfaEnabled: true })
                  toast.success('Two-step sign-in is on')
                })
              }}
            >
              <div className="max-w-[12rem]">
                <Input
                  label="6-digit code"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  maxLength={6}
                  required
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" loading={busy} disabled={code.length !== 6}>
                  Verify and turn on
                </Button>
                <Button type="button" variant="ghost" disabled={busy} onClick={() => void startSetup(true)}>
                  New QR code
                </Button>
                <Button type="button" variant="ghost" disabled={busy} onClick={() => setSetup(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
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
              toast.success('Two-step sign-in is off')
            })
          }}
        >
          <div className="max-w-sm">
            <Input
              label="6-digit code to turn it off"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoComplete="one-time-code"
              placeholder="6-digit code from your app"
              required
            />
          </div>
          <Button type="submit" variant="danger" loading={busy} disabled={!code.trim()}>
            Turn off two-step sign-in
          </Button>
        </form>
      ) : null}

      {error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </Panel>
  )
}

function PasswordPanel() {
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const { busy, error, run } = useAction()

  const tooShort = newPassword.length > 0 && newPassword.length < MIN_PASSWORD
  const mismatch = confirmPassword.length > 0 && confirmPassword !== newPassword
  const ready = currentPassword && newPassword.length >= MIN_PASSWORD && newPassword === confirmPassword

  return (
    <Panel title="Password" description="Changing it signs you out everywhere.">
      <form
        className="grid max-w-md gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          if (!ready) return
          void run(async () => {
            await authApi.changePassword({ currentPassword, newPassword })
            toast.success('Password changed — sign in again')
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
          minLength={MIN_PASSWORD}
          required
          error={tooShort ? `At least ${MIN_PASSWORD} characters` : undefined}
        />
        <Input
          label="Confirm new password"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          minLength={MIN_PASSWORD}
          required
          error={mismatch ? 'Passwords do not match' : undefined}
        />
        {error ? (
          <p className="text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        ) : null}
        <div>
          <Button type="submit" loading={busy} disabled={!ready}>
            Change password
          </Button>
        </div>
      </form>
    </Panel>
  )
}

export function Security() {
  const user = useAuthStore((s) => s.user)
  if (!user) return null

  return (
    <div className="mx-auto w-full max-w-3xl min-w-0 space-y-4 sm:space-y-6">
      <AdminHeader title="Security" description={`Signed in as ${user.email}`} />
      <TwoStepPanel />
      <PasswordPanel />
    </div>
  )
}
