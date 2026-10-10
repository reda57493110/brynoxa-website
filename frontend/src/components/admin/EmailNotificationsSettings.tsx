import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { useToastStore } from '@/store/toastStore'
import type { EmailEvent, EmailMessageEvent, StoreSettings } from '@/types'

const EMAILS: { key: EmailEvent; label: string; when: string; customer: boolean }[] = [
  { key: 'orderPlaced', label: 'Order received', when: 'Right after a customer places an order (with deposit details when one is needed).', customer: true },
  { key: 'orderConfirmed', label: 'Order confirmed', when: 'When you change the order status to Confirmed.', customer: true },
  { key: 'orderShipped', label: 'Order shipped', when: 'When you change the status to Shipped — tells the customer how much cash to prepare.', customer: true },
  { key: 'orderDelivered', label: 'Order delivered & paid', when: 'When you mark the order Delivered — confirms the payment and starts the warranty.', customer: true },
  { key: 'orderCancelled', label: 'Order cancelled', when: 'When an order is cancelled by you or the customer (mentions a deposit refund if one was paid).', customer: true },
  { key: 'depositRequested', label: 'Deposit needed', when: 'When you add or change a deposit on a pending order.', customer: true },
  { key: 'depositReceived', label: 'Deposit received', when: 'When you mark a deposit as received — payment confirmation with the balance due.', customer: true },
  { key: 'staffNewOrder', label: 'New order alert (staff)', when: 'Sent to the store email (ADMIN_EMAIL) for every new order.', customer: false },
  { key: 'securityAlerts', label: 'Account security alerts', when: 'Password changed or reset, two-step sign-in turned on or off.', customer: false },
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

  useEffect(() => {
    if (!settings) return
    setEnabled(settings.emailNotifications ?? {})
    setMessages(settings.emailMessages ?? {})
  }, [settings])

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

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold">Email notifications</h2>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          Sent automatically when orders and payments change. Verification and password-reset emails are always sent.
          “Send test” emails a sample with a made-up order to your own address.
        </p>
      </div>

      <div className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)]">
        {EMAILS.map(({ key, label, when, customer }) => {
          const on = enabled[key] !== false
          const messageKey = isMessageEvent(key) ? key : null
          return (
            <div key={key} className="p-4">
              <div className="flex flex-wrap items-start gap-3">
                <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={on}
                    onChange={(e) => setEnabled({ ...enabled, [key]: e.target.checked })}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">
                      {label}
                      {!customer ? <span className="ms-2 text-xs font-normal text-[var(--fg-muted)]">internal</span> : null}
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--fg-muted)]">{when}</span>
                  </span>
                </label>
                {messageKey ? (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setOpen(open === messageKey ? null : messageKey)}
                    >
                      {messages[messageKey]?.trim() ? 'Edit message' : 'Add message'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!savedEnabled(key)}
                      title={savedEnabled(key) ? undefined : 'Turn it on and save first'}
                      loading={test.isPending && test.variables === messageKey}
                      onClick={() => test.mutate(messageKey)}
                    >
                      Send test
                    </Button>
                  </div>
                ) : null}
              </div>
              {messageKey && open === messageKey ? (
                <div className="mt-3">
                  <Textarea
                    label="Extra message (optional)"
                    value={messages[messageKey] ?? ''}
                    onChange={(e) => setMessages({ ...messages, [messageKey]: e.target.value })}
                    rows={3}
                    maxLength={1000}
                    placeholder="Shown in a “A note from Brynoxa” box in this email."
                  />
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      <Button type="button" onClick={() => save.mutate()} loading={save.isPending}>
        Save email settings
      </Button>
    </section>
  )
}
