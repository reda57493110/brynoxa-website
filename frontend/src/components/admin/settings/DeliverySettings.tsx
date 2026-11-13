import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { toast } from '@/store/toastStore'
import { formatCurrency } from '@/lib/format'
import { deliveryAlwaysIncluded, resolveShippingFee, type ShippingSettingsLike } from '@/lib/shipping'
import type { StoreSettings } from '@/types'
import { SaveBar, SettingsCard } from './SettingsUi'
import { useReportDirty } from './dirty'

/** Suggestions while typing a city (the customer's city must be written the same way; accents and capitals do not matter) */
const COMMON_CITIES = ['Casablanca', 'Rabat', 'Salé', 'Témara', 'Kénitra', 'Mohammedia', 'Marrakech', 'Fès', 'Meknès', 'Tanger', 'Tétouan', 'Agadir', 'Oujda', 'Nador', 'El Jadida', 'Safi', 'Béni Mellal', 'Khouribga', 'Settat', 'Laâyoune', 'Dakhla', 'Errachidia', 'Ouarzazate', 'Taza', 'Al Hoceïma', 'Larache', 'Ksar El Kébir', 'Berrechid', 'Essaouira', 'Guelmim']

type Row = { key: number; city: string; rate: string }
let seq = 0

const money = (v: string) => (v.trim() === '' ? 0 : Number(v))
const badMoney = (v: string) => v.trim() !== '' && (!Number.isFinite(Number(v)) || Number(v) < 0 || Number(v) > 100_000)

/**
 * Admin → Settings → Delivery: what the customer pays for delivery (cash on delivery). The checkout
 * and the server use the same rules (lib/shipping.ts / backend utils/shipping.ts): free from an
 * amount (after the coupon), else the city's price, else the price for everywhere else.
 */
export function DeliverySettings({ settings }: { settings?: StoreSettings }) {
  const qc = useQueryClient()
  const [flat, setFlat] = useState('')
  const [freeFrom, setFreeFrom] = useState('')
  const [rows, setRows] = useState<Row[]>([])

  const reset = useCallback(() => {
    setFlat(settings?.shippingFlatRate ? String(settings.shippingFlatRate) : '')
    setFreeFrom(settings?.freeShippingMin ? String(settings.freeShippingMin) : '')
    setRows((settings?.shippingByCity ?? []).map((r) => ({ key: ++seq, city: r.city, rate: String(r.rate) })))
  }, [settings])
  useEffect(reset, [reset])

  const cityKey = (c: string) => c.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase().replace(/\s+/g, ' ')
  const rowErrors = rows.map((r, i) => {
    if (r.city.trim().length < 2) return 'Write the city'
    if (rows.findIndex((o) => cityKey(o.city) === cityKey(r.city)) !== i) return 'Already in the list'
    if (r.rate.trim() === '' || badMoney(r.rate)) return 'Price in DH (0 = free)'
    return undefined
  })
  const invalid = badMoney(flat) || badMoney(freeFrom) || rowErrors.some(Boolean)

  const draft: ShippingSettingsLike = {
    shippingFlatRate: money(flat),
    freeShippingMin: money(freeFrom),
    shippingByCity: rows.map((r) => ({ city: r.city.trim().replace(/\s+/g, ' '), rate: money(r.rate) })),
  }
  const savedDraft: ShippingSettingsLike = {
    shippingFlatRate: settings?.shippingFlatRate ?? 0,
    freeShippingMin: settings?.freeShippingMin ?? 0,
    shippingByCity: (settings?.shippingByCity ?? []).map((r) => ({ city: r.city, rate: r.rate })),
  }
  const dirty = Boolean(settings) && JSON.stringify(draft) !== JSON.stringify(savedDraft)
  useReportDirty('delivery', dirty)

  const save = useMutation({
    mutationFn: () => adminApi.settings.update(draft as Partial<StoreSettings>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-settings'] })
      qc.invalidateQueries({ queryKey: ['settings'] })
      toast.success('Delivery prices saved')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  // A few examples of what the customer would pay, with the prices being typed
  const exampleCity = draft.shippingByCity?.[0]?.city
  const examples = [
    { label: 'Order of 500 DH, another city', fee: resolveShippingFee(draft, 'another-city', 500) },
    ...(exampleCity ? [{ label: `Order of 500 DH, ${exampleCity}`, fee: resolveShippingFee(draft, exampleCity, 500) }] : []),
    ...(draft.freeShippingMin > 0 ? [{ label: `Order of ${formatCurrency(draft.freeShippingMin)} or more`, fee: 0 }] : []),
  ]
  const allFree = deliveryAlwaysIncluded(draft)

  return (
    <SettingsCard
      title="Delivery prices"
      description="What the customer pays for delivery, added at checkout. Leave everything at 0 for free delivery everywhere (the shop then says delivery is included)."
      footer={<SaveBar dirty={dirty} saving={save.isPending} invalid={invalid} error={invalid ? 'Fix the highlighted fields' : undefined} onReset={reset} onSave={() => save.mutate()} />}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Delivery price, all cities (DH)"
          type="number"
          min={0}
          step="any"
          placeholder="0 = free"
          value={flat}
          onChange={(e) => setFlat(e.target.value)}
          error={badMoney(flat) ? '0 or more' : undefined}
        />
        <Input
          label="Free delivery from (DH, after coupon)"
          type="number"
          min={0}
          step="any"
          placeholder="0 = never free"
          value={freeFrom}
          onChange={(e) => setFreeFrom(e.target.value)}
          error={badMoney(freeFrom) ? '0 or more' : undefined}
        />
      </div>

      <div className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">Price by city</p>
            <p className="text-[11px] text-[var(--fg-muted)]">A different price for some cities (e.g. cheaper in your city). Accents and capitals do not matter.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setRows((r) => [...r, { key: ++seq, city: '', rate: '' }])} disabled={rows.length >= 200}>
            <SiteIcon name="plus" size={13} /> Add a city
          </Button>
        </div>
        {rows.length ? (
          <ul className="mt-2 space-y-2">
            {rows.map((r, i) => (
              <li key={r.key} className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <Input
                    aria-label="City"
                    placeholder="City"
                    list="delivery-cities"
                    value={r.city}
                    maxLength={80}
                    onChange={(e) => setRows((list) => list.map((x) => (x.key === r.key ? { ...x, city: e.target.value } : x)))}
                    error={rowErrors[i] && rowErrors[i] !== 'Price in DH (0 = free)' ? rowErrors[i] : undefined}
                  />
                </div>
                <div className="w-28 shrink-0 sm:w-36">
                  <Input
                    aria-label={`Price for ${r.city || 'this city'} (DH)`}
                    type="number"
                    min={0}
                    step="any"
                    placeholder="DH"
                    value={r.rate}
                    onChange={(e) => setRows((list) => list.map((x) => (x.key === r.key ? { ...x, rate: e.target.value } : x)))}
                    error={rowErrors[i] === 'Price in DH (0 = free)' ? rowErrors[i] : undefined}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setRows((list) => list.filter((x) => x.key !== r.key))}
                  aria-label={`Remove ${r.city || 'this city'}`}
                  className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:text-[var(--danger)]"
                >
                  <SiteIcon name="trash" size={14} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-[var(--fg-muted)]">No city with its own price: every city pays the delivery price above.</p>
        )}
        <datalist id="delivery-cities">
          {COMMON_CITIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>

      <div className="mt-4 rounded-xl bg-[var(--bg-muted)] p-3 text-xs">
        <p className="font-medium">What the customer pays</p>
        {allFree ? (
          <p className="mt-1 text-[var(--fg-muted)]">Free delivery everywhere — the shop shows “delivery included”.</p>
        ) : (
          <ul className="mt-1 space-y-0.5 text-[var(--fg-muted)]">
            {examples.map((x) => (
              <li key={x.label} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">{x.label}</span>
                <span className="shrink-0 font-semibold tabular-nums text-[var(--fg)]">{x.fee > 0 ? formatCurrency(x.fee) : 'Free'}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SettingsCard>
  )
}
