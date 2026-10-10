import { useDeferredValue, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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

const DEFAULT_OPTIONS = ['ram_gb', 'storage', 'capacity_gb', 'color']

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['admin-product'] })
  qc.invalidateQueries({ queryKey: ['admin-products'] })
  qc.invalidateQueries({ queryKey: ['admin-inventory'] })
}

/**
 * Variants of a product (same model, different RAM / storage / colour…). Each variant is its own
 * product with its own SKU, price and stock; the shop shows them as one product with options.
 */
export function VariantsPanel({ product, templateId, dirty }: { product: Product; templateId: string; dirty: boolean }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const variants = product.variants ?? []
  const inGroup = Boolean(product.variantGroup) && variants.length > 1
  const choices = variantableFields(templateId)
  const saved = (product.variantAttributes ?? []).filter((k) => SPEC_FIELDS[k])
  const [attributes, setAttributes] = useState<string[]>(() =>
    saved.length ? saved : DEFAULT_OPTIONS.filter((k) => choices.includes(k))
  )
  const [linking, setLinking] = useState(false)
  const [query, setQuery] = useState('')
  const [confirmLeave, setConfirmLeave] = useState(false)
  const q = useDeferredValue(query.trim())

  useEffect(() => {
    if (saved.length) setAttributes(saved)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when another product loads
  }, [product._id, product.variantAttributes?.join()])

  const attrsChanged = inGroup && attributes.join() !== saved.join()
  const labels = (attrs: string[]) => Object.fromEntries(variants.map((v) => [v._id, variantLabel(v.specs, templateId, attrs)]))

  const create = useMutation({
    mutationFn: async () => (await adminApi.products.addVariant(product._id, { attributes })).data.data,
    onSuccess: (created) => {
      invalidate(qc)
      toast.success('Variant created (inactive). Set its options and price, then activate it.')
      navigate(`/admin/products/${created._id}/edit`)
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const link = useMutation({
    mutationFn: (otherId: string) => adminApi.products.addVariant(product._id, { attributes, productId: otherId }),
    onSuccess: () => {
      invalidate(qc)
      setLinking(false)
      setQuery('')
      toast.success('Product added as a variant')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const saveOptions = useMutation({
    mutationFn: () => adminApi.products.updateVariants(product._id, { attributes, labels: labels(attributes) }),
    onSuccess: () => {
      invalidate(qc)
      toast.success('Options saved')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const leave = useMutation({
    mutationFn: () => adminApi.products.leaveVariants(product._id),
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
    enabled: linking && q.length >= 2,
  })
  const memberIds = new Set(variants.map((v) => v._id))
  const results = (search.data ?? []).filter((p) => p._id !== product._id && !memberIds.has(p._id))

  const dupes = inGroup ? duplicateVariants(variants, templateId, saved) : []
  const busy = create.isPending || link.isPending || saveOptions.isPending

  return (
    <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-muted)]/30 p-3 sm:col-span-2 sm:p-4">
      <div>
        <p className="text-sm font-semibold">Variants{inGroup ? ` (${variants.length})` : ''}</p>
        <p className="text-xs text-[var(--fg-muted)]">
          Same model with different options, e.g. 8 GB or 16 GB RAM. Each variant has its own SKU, price and stock; the shop
          shows one product with option buttons.
        </p>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium">Options customers choose</p>
        <div className="flex flex-wrap gap-1.5">
          {choices.map((k) => {
            const on = attributes.includes(k)
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                disabled={!on && attributes.length >= 4}
                onClick={() => setAttributes(on ? attributes.filter((a) => a !== k) : [...attributes, k])}
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
        {attrsChanged ? (
          <Button type="button" size="sm" className="mt-2" loading={saveOptions.isPending} onClick={() => saveOptions.mutate()}>
            Save options for all variants
          </Button>
        ) : null}
      </div>

      {inGroup ? (
        <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
          {variants.map((v) => {
            const current = v._id === product._id
            const label = variantLabel(v.specs, templateId, saved) || 'Options not set'
            return (
              <li key={v._id} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {label}
                    {current ? <span className="ms-1.5 text-xs font-normal text-[var(--fg-muted)]">· this one</span> : null}
                  </p>
                  <p className="truncate text-[11px] text-[var(--fg-muted)]">{v.sku}</p>
                </div>
                <span className="text-sm tabular-nums">{formatCurrency(v.price)}</span>
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
      ) : null}

      {dupes.length ? (
        <p className="text-xs text-[var(--warning)]">
          {dupes.map((list) => list.map((v) => v.sku).join(' & ')).join(', ')}: same options — set different values (e.g. RAM)
          on each so customers can tell them apart.
        </p>
      ) : null}

      {dirty ? (
        <p className="text-xs text-[var(--warning)]">Save your changes first, then add variants.</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={dirty || busy || !attributes.length}
          loading={create.isPending}
          onClick={() => create.mutate()}
        >
          <SiteIcon name="plus" size={14} /> {inGroup ? 'Add another variant' : 'Create a variant'}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={dirty || busy || !attributes.length} onClick={() => setLinking((v) => !v)}>
          Link an existing product
        </Button>
        {inGroup ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmLeave(true)}>
            Remove this one from variants
          </Button>
        ) : null}
      </div>
      {!attributes.length ? <p className="text-xs text-[var(--fg-muted)]">Pick at least one option above.</p> : null}

      {linking ? (
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
                        {p.variantGroup ? ' · in another variant group' : ''}
                      </p>
                    </div>
                    <Button type="button" size="sm" variant="outline" loading={link.isPending && link.variables === p._id} disabled={link.isPending} onClick={() => link.mutate(p._id)}>
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
        title="Remove from variants?"
        description="This product becomes a standalone product again, with its own page in the shop. Nothing is deleted."
        confirmLabel="Remove"
        loading={leave.isPending}
        onClose={() => setConfirmLeave(false)}
        onConfirm={() => leave.mutate()}
      />
    </section>
  )
}
