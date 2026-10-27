import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useDepositMethods } from '@/hooks/useDepositMethods'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { toast } from '@/store/toastStore'
import { formatDateTime } from '@/lib/format'
import type { DepositMethod, DepositMethodType, StoreSettings } from '@/types'
import { DEFAULT_ATM_CODES, STEP_PLACEHOLDERS, defaultSteps, depositSteps } from '@/lib/depositSteps'
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
  { value: 'atm', label: 'ATM — cardless withdrawal', placeholder: 'Phone number the money is sent to' },
  { value: 'other', label: 'Other', placeholder: 'Account, phone or number' },
]
const OTHER_TYPE = METHOD_TYPES[METHOD_TYPES.length - 1]
const MAX_METHODS = 8
const newMethod = (type: DepositMethodType = 'bank'): DepositMethod => ({
  id: Math.random().toString(36).slice(2, 10),
  type,
  name: type === 'bank' ? '' : METHOD_TYPES.find((m) => m.value === type)!.label,
  holder: '',
  account: '',
  note: '',
  steps: '',
  fees: '',
})

/** ATM cardless withdrawal: the codes the customer must send (your labels, up to 4). */
function AtmCodesEditor({ method, onChange }: { method: DepositMethod; onChange: (labels: string[]) => void }) {
  const labels = method.codeLabels?.length ? method.codeLabels : DEFAULT_ATM_CODES
  const set = (i: number, value: string) => onChange(labels.map((l, j) => (j === i ? value : l)))
  return (
    <div className="space-y-2 rounded-xl border border-[var(--border)] p-3 sm:col-span-2">
      <p className="text-sm font-medium">Codes the customer sends</p>
      <p className="text-[11px] text-[var(--fg-muted)]">
        Name them as your bank / ATM shows them (e.g. red code, green code, 4-digit PIN). The customer must fill each one.
      </p>
      <div className="space-y-1.5">
        {labels.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-5 text-center text-xs font-bold text-[var(--fg-muted)]">{i + 1}</span>
            <input
              value={label}
              maxLength={40}
              onChange={(e) => set(i, e.target.value)}
              aria-label={`Code ${i + 1} name`}
              className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-3 text-sm outline-none ring-brand"
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 !px-0 text-[var(--danger)]"
              aria-label="Remove code"
              disabled={labels.length <= 1}
              onClick={() => onChange(labels.filter((_, j) => j !== i))}
            >
              <SiteIcon name="trash" size={13} />
            </Button>
          </div>
        ))}
      </div>
      {labels.length < 4 ? (
        <Button size="sm" variant="outline" onClick={() => onChange([...labels, 'Code'])}>
          <SiteIcon name="plus" size={13} /> Add a code
        </Button>
      ) : null}
    </div>
  )
}

/** The customer's step-by-step for one payment option: default or written by staff, with a live example. */
function StepsEditor({ method, onChange }: { method: DepositMethod; onChange: (steps: string) => void }) {
  const custom = Boolean(method.steps?.trim())
  const [open, setOpen] = useState(custom)
  // The worked example is long: shown on demand
  const [showExample, setShowExample] = useState(false)
  const example = depositSteps(method, { customer: 'Ahmed', amount: '500 DH', order: 'BRX-20261020-K7M2QX' })
  const insert = (token: string) => onChange(`${method.steps || defaultSteps(method.type)}${(method.steps || '').endsWith('\n') || !method.steps ? '' : ' '}${token}`)

  return (
    <div className="space-y-2 sm:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Steps for the customer</p>
        <div className="flex gap-3 text-xs">
          {custom ? (
            <button type="button" className="font-medium text-[var(--fg-muted)] hover:underline" onClick={() => onChange('')}>
              Use default steps
            </button>
          ) : null}
          <button
            type="button"
            className="font-medium text-[var(--brand-text)] hover:underline"
            onClick={() => {
              if (!open && !custom) onChange(defaultSteps(method.type))
              setOpen((v) => !v)
            }}
          >
            {open ? 'Hide editor' : 'Edit steps'}
          </button>
        </div>
      </div>
      {open ? (
        <>
          <Textarea
            aria-label="Steps for the customer"
            rows={4}
            maxLength={1500}
            value={method.steps || ''}
            placeholder={defaultSteps(method.type)}
            onChange={(e) => onChange(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-[var(--fg-muted)]">One step per line. Insert:</span>
            {STEP_PLACEHOLDERS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => insert(p)}
                className="h-6 rounded-full border border-[var(--border)] px-2 font-mono text-[10px] text-[var(--fg-muted)] hover:border-[var(--brand)] hover:text-[var(--fg)]"
              >
                {p}
              </button>
            ))}
          </div>
        </>
      ) : null}
      <button
        type="button"
        onClick={() => setShowExample((v) => !v)}
        aria-expanded={showExample}
        className="inline-flex items-center gap-1 text-xs font-medium text-[var(--fg-muted)] hover:text-[var(--fg)]"
      >
        {showExample ? 'Hide example' : 'See example'}
        <SiteIcon name="chevron-down" size={12} className={showExample ? 'rotate-180 transition' : 'transition'} />
      </button>
      {showExample ? (
        <div className="rounded-xl bg-[var(--bg-muted)] px-3 py-2">
          <p className="mb-1 text-[11px] font-medium text-[var(--fg-muted)]">
            Example — customer Ahmed, deposit 500 DH{custom ? '' : ' (default steps)'}
          </p>
          <ol className="list-decimal space-y-0.5 ps-4 text-xs">
            {example.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  )
}

/** Deposit payment options (bank, Cash Plus, Wafacash…) and extra instructions, shown on the customer's order. */
export function OrdersSettings() {
  const qc = useQueryClient()
  const current = useDepositMethods()
  const savedText = current.data?.depositInstructions ?? ''
  const savedMethods = useMemo(() => current.data?.depositMethods ?? [], [current.data?.depositMethods])
  const [text, setText] = useState(savedText)
  const [methods, setMethods] = useState<DepositMethod[]>(savedMethods)
  useEffect(() => setText(savedText), [savedText])
  useEffect(() => setMethods(savedMethods), [savedMethods])
  const save = useMutation({
    mutationFn: (payload: { depositMethods: DepositMethod[]; depositInstructions: string }) => adminApi.depositMethods.save(payload),
    onSuccess: (res) => {
      qc.setQueryData(['admin-deposit-methods'], res.data.data)
      toast.success('Payment options saved')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

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
      title="Your payment details"
      description={
        <>
          Private: only customers you ask for a deposit see them, on their order page. Switch an option off to keep it without showing it.
          {current.data?.changedAt ? (
            <span className="mt-1 block font-medium text-[var(--fg)]">
              Last changed {formatDateTime(current.data.changedAt)}
              {current.data.changedBy ? ` by ${current.data.changedBy}` : ''}
            </span>
          ) : null}
        </>
      }
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
          const type = METHOD_TYPES.find((t) => t.value === m.type) ?? OTHER_TYPE
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
                <label className="flex cursor-pointer items-center gap-2 text-xs" title="Shown to customers asked for a deposit">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={m.visible !== false}
                    onChange={(e) => patch(m.id, { visible: e.target.checked })}
                  />
                  <span className="relative h-5 w-9 rounded-full bg-[var(--border)] transition peer-checked:bg-[var(--success)] after:absolute after:start-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-4 rtl:peer-checked:after:-translate-x-4" />
                  <span className="text-[var(--fg-muted)]">{m.visible !== false ? 'Visible' : 'Hidden'}</span>
                </label>
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
                  <Input
                    label="Transfer fees (shown to the customer)"
                    value={m.fees ?? ''}
                    maxLength={160}
                    placeholder={m.type === 'bank' ? 'e.g. No fees between accounts' : 'e.g. Fees ≈35–45 DH, paid by the sender'}
                    onChange={(e) => patch(m.id, { fees: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Input label="Note (optional)" value={m.note} maxLength={300} placeholder="e.g. Open 9:00–19:00" onChange={(e) => patch(m.id, { note: e.target.value })} />
                </div>
                {m.type === 'atm' ? <AtmCodesEditor method={m} onChange={(codeLabels) => patch(m.id, { codeLabels })} /> : null}
                <StepsEditor method={m} onChange={(steps) => patch(m.id, { steps })} />
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
