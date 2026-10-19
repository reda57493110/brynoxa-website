import { useDeferredValue } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { SafeImage } from '@/components/ui/SafeImage'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { Spinner } from '@/components/ui/Spinner'
import { formatCurrency } from '@/lib/format'
import { toPicked, type PickedProduct } from '@/lib/recommended'
import { cn } from '@/lib/cn'
import { en } from '@/i18n/en'
import type { Product } from '@/types'

/** English label of a setup kind ("usb-hub" → "USB-C hub"); admin is English. */
function kindLabel(kind: string) {
  const key = kind.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase()) as keyof typeof en.setupKind
  return en.setupKind[key] ?? kind
}

export interface SetupDraft {
  productId?: string
  name: string
  category: string
  specTemplate?: string
  tags: string[]
  specs: Record<string, string>
}

/**
 * Admin product form: live preview of "Complete your setup" from the form's current values — the
 * detected product kind, the accessory kinds it looks for (found in the shop or missing) and the
 * automatic suggestions, each with Pin (always show, first) and Hide (never show here).
 */
export function SetupPreview({
  draft,
  picks,
  hidden,
  only,
  onPin,
  onHide,
  onUnhide,
}: {
  draft: SetupDraft
  picks: PickedProduct[]
  hidden: PickedProduct[]
  only: boolean
  onPin: (p: PickedProduct) => void
  onHide: (p: PickedProduct) => void
  onUnhide: (id: string) => void
}) {
  // Wait for typing to settle before asking the server
  const payload = useDeferredValue(
    JSON.stringify({ ...draft, picks: picks.map((p) => p._id), hidden: hidden.map((p) => p._id) })
  )
  const ready = draft.name.trim().length >= 2 || Boolean(draft.category)

  const preview = useQuery({
    queryKey: ['admin-setup-preview', payload],
    queryFn: async () => (await adminApi.products.setupPreview(JSON.parse(payload))).data.data,
    enabled: ready && !only,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })

  if (only) {
    return (
      <p className="rounded-xl bg-[var(--bg-muted)] px-3 py-2 text-xs text-[var(--fg-muted)] sm:col-span-2">
        Only your picks are shown — automatic suggestions are off.
      </p>
    )
  }

  const data = preview.data
  const missing = data?.wanted.filter((w) => !w.available) ?? []

  return (
    <div className="min-w-0 space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-muted)]/30 p-3 sm:col-span-2 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <SiteIcon name="layers" size={14} className="text-[var(--brand-text)]" />
            Automatic suggestions
            {preview.isFetching ? <Spinner size="sm" className="ms-1" /> : null}
          </p>
          <p className="text-xs text-[var(--fg-muted)]">
            {data
              ? <>Detected as <strong className="text-[var(--fg)]">{kindLabel(data.kind)}</strong> · updates as you fill the form</>
              : 'Enter a name and a category to see what customers will be offered.'}
          </p>
        </div>
      </div>

      {data?.wanted.length ? (
        <div>
          <p className="mb-1.5 text-[11px] font-medium text-[var(--fg-muted)]">Looks for, in this order</p>
          <div className="flex flex-wrap gap-1.5">
            {data.wanted.map((w) => (
              <span
                key={w.kind}
                className={cn(
                  'inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium',
                  w.available
                    ? 'border-transparent bg-[color-mix(in_srgb,var(--success)_14%,transparent)] text-[var(--success)]'
                    : 'border-dashed border-[var(--border)] text-[var(--fg-muted)]'
                )}
                title={w.available ? `${w.available} in stock in your shop` : 'None in stock in your shop yet'}
              >
                <SiteIcon name={w.available ? 'check' : 'minus'} size={11} />
                {kindLabel(w.kind)}
              </span>
            ))}
          </div>
          {missing.length ? (
            <p className="mt-1.5 text-[11px] text-[var(--fg-muted)]">
              Grey = none in stock yet. Add such products (clear name or Product type, e.g. “Logitech gaming mouse”) and they
              appear here automatically.
            </p>
          ) : null}
        </div>
      ) : data ? (
        <p className="text-xs text-[var(--fg-muted)]">This type of product has no automatic suggestions — use your picks below.</p>
      ) : null}

      {data ? (
        data.items.length ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {data.items.map((p: Product) => {
              const image = p.images?.find((i) => i.isPrimary)?.url || p.images?.[0]?.url
              return (
                <li key={p._id} className="flex min-w-0 items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-2">
                  <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-muted)]">
                    {image ? <SafeImage src={image} alt="" className="h-full w-full object-cover" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    {p.setupKind ? (
                      <span className="block truncate text-[10px] font-semibold uppercase tracking-wide text-[var(--brand-text)]">
                        {kindLabel(p.setupKind)}
                      </span>
                    ) : null}
                    <span className="block truncate text-sm font-medium">{p.name}</span>
                    <span className="block text-[11px] tabular-nums text-[var(--fg-muted)]">
                      {formatCurrency(p.price)} · {p.stock} in stock
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => onPin(toPicked(p))}
                      disabled={picks.length >= 12}
                      className="h-7 rounded-full border border-[var(--border)] px-2.5 text-[11px] font-medium text-[var(--brand-text)] hover:border-[var(--brand)] disabled:opacity-40"
                      title="Always show it, before the automatic ones"
                    >
                      Pin
                    </button>
                    <button
                      type="button"
                      onClick={() => onHide(toPicked(p))}
                      className="h-7 rounded-full px-2.5 text-[11px] font-medium text-[var(--fg-muted)] hover:text-[var(--danger)]"
                      title="Never suggest it for this product"
                    >
                      Hide
                    </button>
                  </span>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-[var(--border)] px-3 py-3 text-xs text-[var(--fg-muted)]">
            No matching product in stock yet{picks.length ? ' — only your picks will show.' : ' — the section stays hidden for customers.'}
          </p>
        )
      ) : preview.isLoading && ready ? (
        <div className="flex justify-center py-4">
          <Spinner />
        </div>
      ) : null}

      {hidden.length ? (
        <div>
          <p className="mb-1.5 text-[11px] font-medium text-[var(--fg-muted)]">Hidden for this product</p>
          <div className="flex flex-wrap gap-1.5">
            {hidden.map((h) => (
              <button
                key={h._id}
                type="button"
                onClick={() => onUnhide(h._id)}
                className="inline-flex h-7 max-w-full items-center gap-1 rounded-full border border-[var(--border)] px-2.5 text-[11px] text-[var(--fg-muted)] hover:border-[var(--brand)] hover:text-[var(--fg)]"
                title="Show it again"
              >
                <span className="truncate">{h.name}</span>
                <SiteIcon name="close" size={11} />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
