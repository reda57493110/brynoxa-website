import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { settingsApi } from '@/api/settingsApi'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useToastStore } from '@/store/toastStore'

export function Settings() {
  const qc = useQueryClient()
  const toast = useToastStore((s) => s.push)

  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await settingsApi.get()).data.data,
  })

  const [form, setForm] = useState({
    storeName: 'Brynoxa',
    currency: 'USD',
    shippingFlatRate: 15,
    freeShippingMin: 200,
    taxRate: 0,
    supportEmail: 'support@brynoxa.com',
    codEnabled: true,
  })

  useEffect(() => {
    if (settings.data) {
      setForm({
        storeName: settings.data.storeName,
        currency: settings.data.currency,
        shippingFlatRate: settings.data.shippingFlatRate,
        freeShippingMin: settings.data.freeShippingMin,
        taxRate: settings.data.taxRate,
        supportEmail: settings.data.supportEmail,
        codEnabled: settings.data.codEnabled,
      })
    }
  }, [settings.data])

  const save = useMutation({
    mutationFn: () => adminApi.settings.update(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      toast('Settings saved', 'success')
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  })

  if (settings.isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-[var(--fg-muted)]">Store configuration</p>
      </div>

      <form
        className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate()
        }}
      >
        <Input
          label="Store name"
          value={form.storeName}
          onChange={(e) => setForm({ ...form, storeName: e.target.value })}
        />
        <Input
          label="Currency"
          value={form.currency}
          onChange={(e) => setForm({ ...form, currency: e.target.value })}
        />
        <Input
          label="Flat shipping rate"
          type="number"
          min={0}
          value={form.shippingFlatRate}
          onChange={(e) => setForm({ ...form, shippingFlatRate: Number(e.target.value) })}
        />
        <Input
          label="Free shipping minimum"
          type="number"
          min={0}
          value={form.freeShippingMin}
          onChange={(e) => setForm({ ...form, freeShippingMin: Number(e.target.value) })}
        />
        <Input
          label="Tax rate (%)"
          type="number"
          min={0}
          value={form.taxRate}
          onChange={(e) => setForm({ ...form, taxRate: Number(e.target.value) })}
        />
        <Input
          label="Support email"
          type="email"
          value={form.supportEmail}
          onChange={(e) => setForm({ ...form, supportEmail: e.target.value })}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.codEnabled}
            onChange={(e) => setForm({ ...form, codEnabled: e.target.checked })}
          />
          Cash on delivery enabled
        </label>
        <Button type="submit" loading={save.isPending}>
          Save settings
        </Button>
      </form>
    </div>
  )
}
