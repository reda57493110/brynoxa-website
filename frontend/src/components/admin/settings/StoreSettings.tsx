import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { toast } from '@/store/toastStore'
import type { StoreSettings } from '@/types'
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

/** Payment instructions shown to customers whose order needs a deposit. */
export function OrdersSettings({ settings }: { settings?: StoreSettings }) {
  const saved = settings?.depositInstructions ?? ''
  const [text, setText] = useState(saved)
  useEffect(() => setText(saved), [saved])
  const save = useSaveSettings('Payment settings saved')

  const dirty = text !== saved
  useReportDirty('orders', dirty)

  return (
    <SettingsCard
      title="Deposit payment instructions"
      description="Shown when an order needs a deposit. Set deposits per product or per order."
      footer={
        <SaveBar dirty={dirty} saving={save.isPending} onReset={() => setText(saved)} onSave={() => save.mutate({ depositInstructions: text })} />
      }
    >
      <Textarea
        label="How to pay the deposit"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        maxLength={2000}
        placeholder="e.g. Bank transfer to RIB … (name: …), or Wafacash / CashPlus to … Then send the receipt on WhatsApp with your order number."
      />
      <p className="text-end text-[11px] tabular-nums text-[var(--fg-muted)]">{text.length}/2000</p>
    </SettingsCard>
  )
}
