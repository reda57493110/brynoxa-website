import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Textarea } from '@/components/ui/Textarea'
import { useToastStore } from '@/store/toastStore'
import type { EmailEvent, EmailMessageEvent, StoreSettings } from '@/types'
import { SaveBar, SettingsCard, Switch } from './settings/SettingsUi'
import { useReportDirty } from './settings/dirty'

const EMAILS: { key: EmailEvent; label: string; when: string; customer: boolean }[] = [
  { key: 'orderPlaced', label: 'Order received', when: 'After checkout, with deposit details if needed.', customer: true },
  { key: 'orderConfirmed', label: 'Order confirmed', when: 'Status set to Confirmed.', customer: true },
  { key: 'orderShipped', label: 'Order shipped', when: 'Status set to Shipped, with the cash to prepare.', customer: true },
  { key: 'orderDelivered', label: 'Delivered & paid', when: 'Status set to Delivered; starts the warranty.', customer: true },
  { key: 'orderCancelled', label: 'Order cancelled', when: 'Cancelled by you or the customer.', customer: true },
  { key: 'depositRequested', label: 'Deposit needed', when: 'A deposit is added or changed on a pending order.', customer: true },
  { key: 'depositReceived', label: 'Deposit received', when: 'You mark a deposit as received.', customer: true },
  { key: 'staffNewOrder', label: 'New order alert', when: 'Sent to the store email (ADMIN_EMAIL).', customer: false },
  { key: 'securityAlerts', label: 'Security alerts', when: 'Password or two-step sign-in changes.', customer: false },
]

const isMessageEvent = (key: EmailEvent): key is EmailMessageEvent =>
  key !== 'staffNewOrder' && key !== 'securityAlerts'

/** Admin: switch automatic emails on/off, add a custom message, and send yourself a test. */
export function EmailNotificationsSettings({ settings }: { settings?: StoreSettings }) {
  const qc = useQueryClient()
  const toast = useToastStore((s) => s.push)
  const [enabled, setEnabled] = useState<Partial<Record<EmailEvent, boolean>>>({})
  const [messages, setMessages] = useState<Partial<Record<EmailMessageEvent, string>>>({})
  const [open, setOpen] = useState<EmailMessageEvent | null>(null)

  const reset = useCallback(() => {
    if (!settings) return
    setEnabled(settings.emailNotifications ?? {})
    setMessages(settings.emailMessages ?? {})
  }, [settings])
  useEffect(reset, [reset])

  const save = useMutation({
    mutationFn: () =>
      adminApi.settings.update({
        emailNotifications: Object.fromEntries(EMAILS.map(({ key }) => [key, enabled[key] !== false])),
        emailMessages: messages,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-settings'] })
      qc.invalidateQueries({ queryKey: ['settings'] })
      toast('Email settings saved', 'success')
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  })

  const test = useMutation({
    mutationFn: (type: EmailMessageEvent) => adminApi.emailTest(type),
    onSuccess: (res) => toast(`Test email sent to ${res.data.data.sentTo}`, 'success'),
    onError: (e) => toast(getErrorMessage(e), 'error'),
  })

  const savedEnabled = (key: EmailEvent) => settings?.emailNotifications?.[key] !== false

  const dirty =
    Boolean(settings) &&
    (EMAILS.some(({ key }) => (enabled[key] !== false) !== savedEnabled(key)) ||
      EMAILS.some(({ key }) => isMessageEvent(key) && (messages[key] ?? '').trim() !== (settings?.emailMessages?.[key] ?? '').trim()))
  useReportDirty('emails', dirty)

  const group = (customer: boolean) => (
    <ul className="divide-y divide-[var(--border)]">
      {EMAILS.filter((e) => e.customer === customer).map(({ key, label, when }) => {
        const messageKey = isMessageEvent(key) ? key : null
        return (
          <li key={key} className="py-3 first:pt-0 last:pb-0">
            <Switch checked={enabled[key] !== false} onChange={(v) => setEnabled({ ...enabled, [key]: v })} label={label} hint={when} />
            {messageKey ? (
              <div className="mt-1.5 flex flex-wrap gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setOpen(open === messageKey ? null : messageKey)}
                  className="font-medium text-[var(--brand-text)] hover:underline"
                >
                  {messages[messageKey]?.trim() ? 'Edit extra message' : 'Add extra message'}
                </button>
                <button
                  type="button"
                  disabled={!savedEnabled(key) || test.isPending}
                  title={savedEnabled(key) ? 'Emails a sample to you' : 'Turn it on and save first'}
                  onClick={() => test.mutate(messageKey)}
                  className="font-medium text-[var(--fg-muted)] hover:text-[var(--fg)] disabled:opacity-40"
                >
                  {test.isPending && test.variables === messageKey ? 'Sending…' : 'Send test'}
                </button>
              </div>
            ) : null}
            {messageKey && open === messageKey ? (
              <div className="mt-2">
                <Textarea
                  aria-label={`Extra message for ${label}`}
                  value={messages[messageKey] ?? ''}
                  onChange={(e) => setMessages({ ...messages, [messageKey]: e.target.value })}
                  rows={3}
                  maxLength={1000}
                  placeholder="Shown in a “A note from Brynoxa” box in this email."
                />
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )

  return (
    <SettingsCard
      title="Automatic emails"
      description="Verification and password-reset emails are always sent."
      footer={<SaveBar dirty={dirty} saving={save.isPending} onReset={reset} onSave={() => save.mutate()} />}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">To customers</p>
      {group(true)}
      <p className="border-t border-[var(--border)] pt-4 text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
        To the store
      </p>
      {group(false)}
    </SettingsCard>
  )
}
