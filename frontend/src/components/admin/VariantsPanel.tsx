import { useDeferredValue, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { formatCurrency } from '@/lib/format'
import { SPEC_FIELDS } from '@/lib/specs'
import { duplicateVariants, variantLabel, variantableFields } from '@/lib/variants'
import { toast } from '@/store/toastStore'
import { cn } from '@/lib/cn'
import type { Product } from '@/types'
import { VariantRows, newVersionRow, type VersionRow } from './VariantRows'

export const DEFAULT_VARIANT_OPTIONS = ['ram_gb', 'storage', 'capacity_gb', 'color']

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['admin-product'] })
  qc.invalidateQueries({ queryKey: ['admin-products'] })
  qc.invalidateQueries({ queryKey: ['admin-inventory'] })
}

/**
 * Versions of a product (same model, different RAM / storage / colour…), right under its specs.
 * Each version is its own product with its own SKU, price and stock; the shop shows them as one
 * product with option buttons. New versions are created when the form is saved.
 */
export function VariantsPanel({
  product,
  templateId,
  mainValues,
  mainPrice,
  mainSku,
  attributes,
  onAttributes,
  rows,
  onRows,
  errors,
  dirty,
}: {
  /** Saved product (edit) or null (new product). */
  product: Product | null
  templateId: string
  /** This product's current spec values (from the form). */
  mainValues: Record<string, string>
  mainPrice: number
  mainSku: string
  attributes: string[]
  onAttributes: (keys: string[]) => void
  rows: VersionRow[]
  onRows: (rows: VersionRow[]) => void
  errors: Record<string, string>
  dirty: boolean
}) {
  const qc = useQueryClient()
  const variants = product?.variants ?? []
  const inGroup = Boolean(product?.variantGroup) && variants.length > 1
  const choices = variantableFields(templateId)
  const [linking, setLinking] = useState(false)
  const [query, setQuery] = useState('')
  const [confirmLeave, setConfirmLeave] = useState(false)
  const q = useDeferredValue(query.trim())

  const link = useMutation({
    mutationFn: (otherId: string) => adminApi.products.addVariant(product!._id, { attributes, productId: otherId }),
    onSuccess: () => {
      invalidate(qc)
      setLinking(false)
      setQuery('')
      toast.success('Product added as a version')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const leave = useMutation({
    mutationFn: () => adminApi.products.leaveVariants(product!._id),
    onSuccess: () => {
      invalidate(qc)
      setConfirmLeave(false)
      toast.success('This product is standalone again')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const search = useQuery({
    queryKey: ['admin-products', 'variant-link', q],
    queryFn: async () => (await adminApi.products.list({ q, limit: 8 })).data.data,
    enabled: Boolean(product) && linking && q.length >= 2,
  })
  const memberIds = new Set(variants.map((v) => v._id))
  const results = (search.data ?? []).filter((p) => p._id !== product?._id && !memberIds.has(p._id))

  const dupes = inGroup ? duplicateVariants(variants, templateId, attributes) : []
  const missingMain = attributes.filter((k) => !(mainValues[k] ?? '').trim())
  const mainLabel = variantLabel(mainValues, templateId, attributes)

  return (
    <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-muted)]/30 p-3 sm:col-span-2 sm:p-4">
      <div>
        <p className="text-sm font-semibold">Versions{inGroup ? ` (${variants.length})` : ''}</p>
        <p className="text-xs text-[var(--fg-muted)]">
          Same product in several versions, e.g. 8 GB / 256 GB and 16 GB / 512 GB. Each version has its own price and
          stock; the shop shows one product with option buttons.
        </p>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium">What changes between versions?</p>
        <div className="flex flex-wrap gap-1.5">
          {choices.map((k) => {
            const on = attributes.includes(k)
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                disabled={!on && attributes.length >= 4}
                onClick={() => onAttributes(on ? attributes.filter((a) => a !== k) : [...attributes, k])}
                className={cn(
                  'h-8 rounded-full border px-2.5 text-xs transition disabled:opacity-40',
                  on
                    ? 'border-transparent bg-[color-mix(in_srgb,var(--brand)_18%,transparent)] font-medium text-[var(--brand-text)]'
                    : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--brand)]'
                )}
              >
                {on ? '✓ ' : ''}
                {SPEC_FIELDS[k].label.en}
              </button>
            )
          })}
        </div>
      </div>

      {/* Existing versions (edit) or this product as version 1 */}
      {inGroup ? (
        <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
          {variants.map((v) => {
            const current = v._id === product?._id
            const label = (current ? mainLabel : variantLabel(v.specs, templateId, attributes)) || 'Options not set'
            return (
              <li key={v._id} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {label}
                    {current ? <span className="ms-1.5 text-xs font-normal text-[var(--fg-muted)]">· this one</span> : null}
                  </p>
                  <p className="truncate text-[11px] text-[var(--fg-muted)]">{v.sku}</p>
                </div>
                <span className="text-sm tabular-nums">{formatCurrency(current ? mainPrice : v.price)}</span>
                <span className={cn('text-xs tabular-nums', v.stock <= 0 ? 'text-[var(--danger)]' : 'text-[var(--fg-muted)]')}>
                  {v.stock} in stock
                </span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-medium',
                    v.isActive
                      ? 'bg-[color-mix(in_srgb,var(--success)_14%,transparent)] text-[var(--success)]'
                      : 'bg-[var(--bg-muted)] text-[var(--fg-muted)]'
                  )}
                >
                  {v.isActive ? 'Active' : 'Inactive'}
                </span>
                {!current ? (
                  <Link to={`/admin/products/${v._id}/edit`} className="text-xs font-medium text-[var(--brand-text)] hover:underline">
                    Edit
                  </Link>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : rows.length ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm">
          <span className="text-xs font-semibold">Version 1 (this product): </span>
          {mainLabel || <span className="text-[var(--fg-muted)]">set its options in the specifications above</span>}
          <span className="text-[var(--fg-muted)]"> · {formatCurrency(mainPrice)}</span>
        </div>
      ) : null}

      {rows.length && missingMain.length ? (
        <p className="text-xs text-[var(--warning)]">
          Fill {missingMain.map((k) => SPEC_FIELDS[k].label.en).join(', ')} in the specifications above for this product too.
        </p>
      ) : null}

      <VariantRows
        attributes={attributes}
        rows={rows}
        onChange={onRows}
        errors={errors}
        skuHint={`${mainSku || 'SKU'}-V…`}
        pricePlaceholder={String(mainPrice || '')}
        firstNumber={inGroup ? variants.length + 1 : 2}
      />

      {dupes.length ? (
        <p className="text-xs text-[var(--warning)]">
          {dupes.map((list) => list.map((v) => v.sku).join(' & ')).join(', ')}: same options — give each version different
          values so customers can tell them apart.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!attributes.length}
          onClick={() => onRows([...rows, newVersionRow(mainPrice ? String(mainPrice) : '')])}
        >
          <SiteIcon name="plus" size={14} /> Add a version
        </Button>
        {product ? (
          <Button type="button" size="sm" variant="ghost" disabled={dirty || !attributes.length} onClick={() => setLinking((v) => !v)}>
            Link an existing product
          </Button>
        ) : null}
        {product && inGroup ? (
          <Button type="button" size="sm" variant="ghost" disabled={dirty} onClick={() => setConfirmLeave(true)}>
            Remove this one from versions
          </Button>
        ) : null}
        {rows.length ? (
          <span className="text-xs text-[var(--fg-muted)]">
            New versions are created when you click {product ? 'Save changes' : 'Create product'}.
          </span>
        ) : null}
      </div>
      {!attributes.length ? <p className="text-xs text-[var(--fg-muted)]">Pick what changes (e.g. RAM, Storage) first.</p> : null}
      {product && dirty ? (
        <p className="text-[11px] text-[var(--fg-muted)]">Save your changes before linking or removing versions.</p>
      ) : null}

      {linking && product ? (
        <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or SKU of the other version"
            className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-3 text-sm outline-none ring-brand"
          />
          {q.length >= 2 ? (
            results.length ? (
              <ul className="divide-y divide-[var(--border)]">
                {results.map((p) => (
                  <li key={p._id} className="flex items-center gap-2 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{p.name}</p>
                      <p className="truncate text-[11px] text-[var(--fg-muted)]">
                        {p.sku} · {formatCurrency(p.price)} · {p.stock} in stock
                        {p.variantGroup ? ' · in another product’s versions' : ''}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      loading={link.isPending && link.variables === p._id}
                      disabled={link.isPending}
                      onClick={() => link.mutate(p._id)}
                    >
                      Link
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-[var(--fg-muted)]">{search.isFetching ? 'Searching…' : 'No other product found.'}</p>
            )
          ) : (
            <p className="text-xs text-[var(--fg-muted)]">Its stock, price and orders stay exactly as they are.</p>
          )}
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmLeave}
        title="Remove from versions?"
        description="This product becomes a standalone product again, with its own page in the shop. Nothing is deleted."
        confirmLabel="Remove"
        loading={leave.isPending}
        onClose={() => setConfirmLeave(false)}
        onConfirm={() => leave.mutate()}
      />
    </section>
  )
}
