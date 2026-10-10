import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { SPEC_FIELDS } from '@/lib/specs'
import { variantLabel } from '@/lib/variants'
import { cn } from '@/lib/cn'
import type { ProductVariant } from '@/types'
import { FieldInput } from './SpecsEditor'

/** One extra version of a product: its option values, price, opening stock and (optional) SKU. */
export interface VersionRow {
  id: string
  values: Record<string, string>
  price: string
  stock: string
  sku: string
}

let seq = 0
export const newVersionRow = (price = ''): VersionRow => ({ id: `v${++seq}`, values: {}, price, stock: '0', sku: '' })

const inputCls =
  'h-10 w-full min-w-0 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-3 text-sm text-[var(--fg)] outline-none ring-brand'

/** Problems that block creating the versions, keyed by row id. */
export function validateVersionRows(rows: VersionRow[], attributes: string[], mainValues: Record<string, string>) {
  const errors: Record<string, string> = {}
  const combo = (v: Record<string, string>) => attributes.map((k) => (v[k] ?? '').trim().toLowerCase()).join('|')
  const seen = new Set([combo(mainValues)])
  for (const r of rows) {
    const missing = attributes.filter((k) => !(r.values[k] ?? '').trim())
    const price = Number(r.price)
    const stock = Number(r.stock || 0)
    const bad = attributes.find((k) => {
      const f = SPEC_FIELDS[k]
      const v = (r.values[k] ?? '').trim()
      if (!v || f.type !== 'number') return false
      const n = Number(v)
      return !Number.isFinite(n) || (f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max)
    })
    if (missing.length) errors[r.id] = `Fill ${missing.map((k) => SPEC_FIELDS[k].label.en).join(', ')}`
    else if (bad) errors[r.id] = `${SPEC_FIELDS[bad].label.en}: invalid number`
    else if (r.price.trim() === '' || !Number.isFinite(price) || price < 0) errors[r.id] = 'Enter a valid price'
    else if (!Number.isInteger(stock) || stock < 0) errors[r.id] = 'Stock must be a whole number (0 or more)'
    else if (seen.has(combo(r.values))) errors[r.id] = 'Same options as another version'
    seen.add(combo(r.values))
  }
  return errors
}

/**
 * Create the versions one by one, then save the option names and labels for the whole group.
 * Returns how many were created and the first error, if any.
 */
export async function createVersions(opts: {
  productId: string
  mainSpecs: Record<string, string>
  templateId: string
  attributes: string[]
  rows: VersionRow[]
  existing?: ProductVariant[]
  isActive: boolean
}) {
  const { productId, mainSpecs, templateId, attributes, rows, existing = [], isActive } = opts
  const labels: Record<string, string> = {}
  for (const v of existing) if (v._id !== productId) labels[v._id] = variantLabel(v.specs, templateId, attributes)
  labels[productId] = variantLabel(mainSpecs, templateId, attributes)
  let created = 0
  let error: string | null = null
  for (const r of rows) {
    const specs = Object.fromEntries(attributes.map((k) => [k, (r.values[k] ?? '').trim()]))
    try {
      const res = await adminApi.products.addVariant(productId, {
        attributes,
        specs,
        price: Number(r.price),
        stock: Math.floor(Number(r.stock || 0)),
        sku: r.sku.trim() || undefined,
        isActive,
      })
      labels[res.data.data._id] = variantLabel({ ...mainSpecs, ...specs }, templateId, attributes)
      created += 1
    } catch (e) {
      error = getErrorMessage(e)
      break
    }
  }
  if (created) {
    try {
      await adminApi.products.updateVariants(productId, { attributes, labels })
    } catch (e) {
      error = error ?? getErrorMessage(e)
    }
  }
  return { created, error }
}

/** Editable list of new versions (option values + price + stock + SKU). */
export function VariantRows({
  attributes,
  rows,
  onChange,
  errors,
  skuHint,
  pricePlaceholder,
  firstNumber = 2,
}: {
  attributes: string[]
  rows: VersionRow[]
  onChange: (rows: VersionRow[]) => void
  errors: Record<string, string>
  skuHint: string
  pricePlaceholder?: string
  firstNumber?: number
}) {
  const update = (id: string, patch: Partial<VersionRow>) => onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div
          key={r.id}
          className={cn(
            'space-y-2 rounded-xl border bg-[var(--bg-elevated)] p-3',
            errors[r.id] ? 'border-[var(--danger)]' : 'border-[var(--border)]'
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold">Version {i + firstNumber}</p>
            <button
              type="button"
              onClick={() => onChange(rows.filter((x) => x.id !== r.id))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:text-[var(--danger)]"
              aria-label={`Remove version ${i + firstNumber}`}
            >
              <SiteIcon name="trash" size={14} />
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {attributes.map((k) => (
              <div key={k} className="min-w-0 space-y-1">
                <label htmlFor={`${r.id}-${k}`} className="text-xs font-medium">
                  {SPEC_FIELDS[k].label.en}
                </label>
                <FieldInput
                  field={SPEC_FIELDS[k]}
                  idPrefix={r.id}
                  value={r.values[k] ?? ''}
                  onChange={(v) => update(r.id, { values: { ...r.values, [k]: v } })}
                />
              </div>
            ))}
            <label className="min-w-0 space-y-1 text-xs font-medium">
              <span>Price (DH)</span>
              <input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={r.price}
                placeholder={pricePlaceholder}
                onChange={(e) => update(r.id, { price: e.target.value })}
                className={inputCls}
              />
            </label>
            <label className="min-w-0 space-y-1 text-xs font-medium">
              <span>Opening stock</span>
              <input
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={r.stock}
                onChange={(e) => update(r.id, { stock: e.target.value })}
                className={inputCls}
              />
            </label>
            <label className="min-w-0 space-y-1 text-xs font-medium">
              <span>SKU (optional)</span>
              <input
                value={r.sku}
                maxLength={60}
                placeholder={skuHint}
                onChange={(e) => update(r.id, { sku: e.target.value })}
                className={inputCls}
              />
            </label>
          </div>
          {errors[r.id] ? <p className="text-xs text-[var(--danger)]">{errors[r.id]}</p> : null}
        </div>
      ))}
    </div>
  )
}
