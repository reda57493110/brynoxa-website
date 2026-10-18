import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { toast } from '@/store/toastStore'
import type { DepositMethod, DepositMethodType, StoreSettings } from '@/types'
import { Button } from '@/components/ui/Button'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { SaveBar, SettingsCard } from './SettingsUi'
import { useReportDirty } from './dirty'

function useSaveSettings(message: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<StoreSettings>) => adminApi.settings.update(patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-settings'] })
      qc.invalidateQueries({ queryKey: ['settings'] })
      toast.success(message)
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
}

/** Store name. */
export function GeneralSettings({ settings }: { settings?: StoreSettings }) {
  const saved = settings?.storeName || 'Brynoxa'
  const [storeName, setStoreName] = useState(saved)
  useEffect(() => setStoreName(saved), [saved])
  const save = useSaveSettings('Store settings saved')

  const dirty = storeName.trim() !== saved
  const error = !storeName.trim() ? 'Store name is required' : undefined
  useReportDirty('general', dirty)

  return (
    <SettingsCard
      title="Store"
      description="Your shop's name in emails and receipts."
      footer={
        <SaveBar
          dirty={dirty}
          saving={save.isPending}
          invalid={Boolean(error)}
          error={dirty ? error : undefined}
          onReset={() => setStoreName(saved)}
          onSave={() => save.mutate({ storeName: storeName.trim() })}
        />
      }
    >
      <div className="max-w-md">
        <Input label="Store name" value={storeName} maxLength={60} onChange={(e) => setStoreName(e.target.value)} />
      </div>
    </SettingsCard>
  )
}

const METHOD_TYPES: { value: DepositMethodType; label: string; placeholder: string }[] = [
  { value: 'bank', label: 'Bank transfer', placeholder: 'RIB (24 digits)' },
  { value: 'cashplus', label: 'Cash Plus', placeholder: 'Phone number or name to send to' },
  { value: 'wafacash', label: 'Wafacash', placeholder: 'Phone number or name to send to' },
  { value: 'barid', label: 'Barid Cash', placeholder: 'Phone number or name to send to' },
  { value: 'other', label: 'Other', placeholder: 'Account, phone or number' },
]
const MAX_METHODS = 8
const newMethod = (type: DepositMethodType = 'bank'): DepositMethod => ({
  id: Math.random().toString(36).slice(2, 10),
  type,
  name: type === 'bank' ? '' : METHOD_TYPES.find((m) => m.value === type)!.label,
  holder: '',
  account: '',
  note: '',
})

/** Deposit payment options (bank, Cash Plus, Wafacash…) and extra instructions, shown on the customer's order. */
export function OrdersSettings({ settings }: { settings?: StoreSettings }) {
  const savedText = settings?.depositInstructions ?? ''
  const savedMethods = useMemo(() => settings?.depositMethods ?? [], [settings?.depositMethods])
  const [text, setText] = useState(savedText)
  const [methods, setMethods] = useState<DepositMethod[]>(savedMethods)
  useEffect(() => setText(savedText), [savedText])
  useEffect(() => setMethods(savedMethods), [savedMethods])
  const save = useSaveSettings('Payment settings saved')

  const dirty = text !== savedText || JSON.stringify(methods) !== JSON.stringify(savedMethods)
  useReportDirty('orders', dirty)

  const patch = (id: string, change: Partial<DepositMethod>) =>
    setMethods((list) => list.map((m) => (m.id === id ? { ...m, ...change } : m)))
  const move = (index: number, by: number) =>
    setMethods((list) => {
      const next = [...list]
      const [m] = next.splice(index, 1)
      next.splice(index + by, 0, m)
      return next
    })

  return (
    <SettingsCard
      title="Deposit payment options"
      description="Shown to customers whose order needs a deposit. They pick one, pay, then send you the reference or a receipt photo from their order page."
      footer={
        <SaveBar
          dirty={dirty}
          saving={save.isPending}
          onReset={() => {
            setText(savedText)
            setMethods(savedMethods)
          }}
          onSave={() =>
            save.mutate({
              depositInstructions: text,
              depositMethods: methods.filter((m) => m.name.trim() || m.account.trim()),
            })
          }
        />
      }
    >
      <div className="space-y-3">
        {methods.map((m, i) => {
          const type = METHOD_TYPES.find((t) => t.value === m.type) ?? METHOD_TYPES[4]
          return (
            <div key={m.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--bg-muted)] text-[11px] font-bold">{i + 1}</span>
                <select
                  value={m.type}
                  onChange={(e) => patch(m.id, { type: e.target.value as DepositMethodType })}
                  aria-label="Payment type"
                  className="h-9 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-2 text-sm"
                >
                  {METHOD_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <div className="ms-auto flex items-center gap-1">
                  <Button size="sm" variant="ghost" className="h-8 w-8 !px-0" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>↑</Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 !px-0" aria-label="Move down" disabled={i === methods.length - 1} onClick={() => move(i, 1)}>↓</Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 !px-0 text-[var(--danger)]" aria-label="Remove" onClick={() => setMethods((list) => list.filter((x) => x.id !== m.id))}>
                    <SiteIcon name="trash" size={14} />
                  </Button>
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Input label={m.type === 'bank' ? 'Bank name' : 'Name shown'} value={m.name} maxLength={60} placeholder={m.type === 'bank' ? 'e.g. CIH Bank' : type.label} onChange={(e) => patch(m.id, { name: e.target.value })} />
                <Input label="Receiver name" value={m.holder} maxLength={80} placeholder="Full name on the account" onChange={(e) => patch(m.id, { holder: e.target.value })} />
                <div className="sm:col-span-2">
                  <Input label={m.type === 'bank' ? 'RIB' : 'Number'} value={m.account} maxLength={80} dir="ltr" placeholder={type.placeholder} onChange={(e) => patch(m.id, { account: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <Input label="Note (optional)" value={m.note} maxLength={300} placeholder="e.g. Write your order number as the reason" onChange={(e) => patch(m.id, { note: e.target.value })} />
                </div>
              </div>
            </div>
          )
        })}
        {methods.length < MAX_METHODS ? (
          <div className="flex flex-wrap gap-2">
            {METHOD_TYPES.map((t) => (
              <Button key={t.value} size="sm" variant="outline" onClick={() => setMethods((list) => [...list, newMethod(t.value)])}>
                <SiteIcon name="plus" size={13} /> {t.label}
              </Button>
            ))}
          </div>
        ) : null}
        {!methods.length ? (
          <p className="text-xs text-[var(--fg-muted)]">No payment options yet: customers only see the text below.</p>
        ) : null}
      </div>

      <div className="mt-5">
        <Textarea
          label="Extra instructions (optional)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="e.g. Write your order number as the transfer reason."
        />
        <p className="text-end text-[11px] tabular-nums text-[var(--fg-muted)]">{text.length}/2000</p>
      </div>
    </SettingsCard>
  )
}
