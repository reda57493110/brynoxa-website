import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { productsApi } from '@/api/productsApi'
import { getErrorMessage } from '@/api/client'
import { SafeImage } from '@/components/ui/SafeImage'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { Spinner } from '@/components/ui/Spinner'
import { Modal } from '@/components/ui/Modal'
import { ProductSearch } from '@/components/admin/PageHeaderProducts'
import { formatCurrency } from '@/lib/format'
import { imageFit, sizedImageUrl } from '@/lib/image'
import { MAX_SIMILAR, suggestSimilar, type SimilarReason } from '@/lib/similarSuggestions'
import { cn } from '@/lib/cn'
import { toast } from '@/store/toastStore'
import { useAdminT } from '@/store/adminLangStore'
import type { Product } from '@/types'

function photo(p: Product) {
  return p.images?.find((i) => i.isPrimary)?.url || p.images?.[0]?.url
}

function Thumb({ p }: { p: Product }) {
  const img = photo(p)
  return (
    <span className={cn('relative block h-20 w-full overflow-hidden', imageFit(img) === 'contain' ? 'bg-white' : 'bg-[var(--bg-muted)]')}>
      {img ? <SafeImage src={sizedImageUrl(img, 280)} alt="" referrerPolicy="no-referrer" className={cn('h-full w-full', imageFit(img) === 'contain' ? 'object-contain p-1 mix-blend-multiply' : 'object-cover')} /> : null}
    </span>
  )
}

/**
 * Admin → Products → Similar products: for one product, the "Similar products" shown under it on
 * its page. Suggestions (same category, closest price, same brand, best sellers — with the
 * reason) to approve, or "My choice" to arrange. With no choice saved, the page picks them itself.
 * Saved on the product (`similar`).
 */
export function SimilarAdmin({ onOpen }: { onOpen: (p: Product) => void }) {
  const tr = useAdminT()
  const qc = useQueryClient()
  const [mainId, setMainId] = useState('')
  const [picking, setPicking] = useState(false)
  const [adding, setAdding] = useState(false)
  const [view, setView] = useState<'suggest' | 'mine'>('suggest')
  const [skip, setSkip] = useState<Set<string>>(new Set())

  const main = useQuery({
    queryKey: ['admin-product', mainId],
    queryFn: async () => (await adminApi.products.get(mainId)).data.data,
    enabled: Boolean(mainId),
  })
  const m = main.data
  const categorySlug = m && typeof m.category === 'object' && m.category ? m.category.slug : ''
  const catalog = useQuery({
    queryKey: ['admin-products', 'similar-pool', categorySlug],
    queryFn: async () => (await adminApi.products.list({ category: categorySlug, limit: 100 })).data.data,
    enabled: Boolean(categorySlug),
  })
  const chosenIds = (m?.similar ?? []).map(String)
  const chosen = useQuery({
    queryKey: ['products', 'compare', chosenIds.join(',')],
    queryFn: async () => (await productsApi.compare(chosenIds)).data.data,
    enabled: chosenIds.length > 0,
  })
  const chosenList = chosenIds.map((id) => chosen.data?.find((p) => p._id === id)).filter((p): p is Product => Boolean(p))
  const suggestions = m && catalog.data ? suggestSimilar(m, catalog.data) : []
  const kept = suggestions.filter((s) => !skip.has(s.product._id))

  const save = useMutation({
    mutationFn: async (next: string[]) => (await adminApi.products.update(mainId, { similar: next.slice(0, MAX_SIMILAR) } as never)).data.data,
    onSuccess: () => {
      for (const k of [['admin-product', mainId], ['admin-products'], ['products']]) qc.invalidateQueries({ queryKey: k })
      toast.success(tr('products.sim.saved'))
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const busy = save.isPending

  const reason = (r: SimilarReason) =>
    r.kind === 'sameBrand'
      ? tr('products.sim.rBrand')
      : r.kind === 'cheaper'
        ? tr('products.sim.rCheaper', { diff: formatCurrency(r.diff) })
        : r.kind === 'pricier'
          ? tr('products.sim.rPricier', { diff: formatCurrency(r.diff) })
          : r.kind === 'bestseller'
            ? tr('products.sim.rBest', { count: r.count })
            : tr('products.sim.rSame')

  const move = (from: number, to: number) => {
    const next = [...chosenIds]
    const [id] = next.splice(from, 1)
    next.splice(to, 0, id)
    save.mutate(next)
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--fg-muted)]">{tr('products.sim.intro')}</p>

      {/* The product */}
      <div className="flex min-w-0 flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-2.5">
        {m ? (
          <>
            <span className="w-16 shrink-0 overflow-hidden rounded-lg">
              <Thumb p={m} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{m.name}</span>
              <span className="block text-xs text-[var(--fg-muted)]">
                {typeof m.category === 'object' && m.category ? m.category.name : ''} · {formatCurrency(m.price)}
              </span>
            </span>
          </>
        ) : (
          <span className="flex-1 text-sm text-[var(--fg-muted)]">{tr('products.sim.pickFirst')}</span>
        )}
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--brand)] px-4 text-xs font-bold text-[var(--brand-fg)]"
        >
          <SiteIcon name="search" size={13} />
          {m ? tr('products.sim.change') : tr('products.sim.pick')}
        </button>
      </div>

      {mainId && (main.isLoading || catalog.isLoading) ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : m ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/25 p-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <SiteIcon name="layers" size={14} className="text-[var(--brand-text)]" />
            <p className="text-[13px] font-semibold">{tr('products.sim.title')}</p>
            <span
              className={cn(
                'rounded-full border px-2 text-[10px] font-semibold leading-[1.15rem]',
                chosenIds.length ? 'border-[var(--brand)] text-[var(--brand-text)]' : 'border-[var(--border)] text-[var(--fg-muted)]'
              )}
            >
              {chosenIds.length ? tr('products.board.yourChoice') : tr('products.board.auto')}
            </span>
            <span role="tablist" className="ms-auto inline-flex rounded-full border border-[var(--border)] bg-[var(--bg)] p-0.5 text-[11px] font-semibold">
              {(['suggest', 'mine'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={view === v}
                  onClick={() => setView(v)}
                  className={cn('rounded-full px-2.5 py-0.5 transition', view === v ? 'bg-[var(--brand)] text-[var(--brand-fg)]' : 'text-[var(--fg-muted)] hover:text-[var(--fg)]')}
                >
                  {v === 'suggest' ? tr('products.sug.tab', { count: suggestions.length }) : tr('products.sug.mine')}
                </button>
              ))}
            </span>
          </div>

          {view === 'suggest' ? (
            suggestions.length ? (
              <>
                <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
                  {suggestions.map((s, i) => {
                    const on = !skip.has(s.product._id)
                    return (
                      <div key={s.product._id} className={cn('flex w-[8.75rem] shrink-0 flex-col overflow-hidden rounded-xl border bg-[var(--bg)]', on ? 'border-[var(--brand)]' : 'border-dashed border-[var(--border)] opacity-60')}>
                        <button type="button" onClick={() => onOpen(s.product)} title={s.product.name} className="text-start">
                          <span className="relative block">
                            <Thumb p={s.product} />
                            <span className="absolute start-1 top-1 rounded-md bg-[var(--fg)] px-1.5 text-[11px] font-bold leading-5 text-[var(--bg)]">#{i + 1}</span>
                          </span>
                          <span className="block px-2 pt-1.5">
                            <span className="block truncate text-xs font-medium">{s.product.name}</span>
                            <span className="block text-[11px] tabular-nums text-[var(--fg-muted)]">{formatCurrency(s.product.price)}</span>
                          </span>
                        </button>
                        <span className="block px-2 pb-1 text-[10px] font-semibold leading-tight text-[var(--brand-text)]">{reason(s.reason)}</span>
                        <label className="mt-auto flex cursor-pointer items-center gap-1.5 border-t border-[var(--border)] px-2 py-1 text-[11px] font-medium">
                          <input
                            type="checkbox"
                            checked={on}
                            className="accent-[var(--brand)]"
                            onChange={() =>
                              setSkip((cur) => {
                                const next = new Set(cur)
                                if (next.has(s.product._id)) next.delete(s.product._id)
                                else next.add(s.product._id)
                                return next
                              })
                            }
                          />
                          {on ? tr('products.sug.keep') : tr('products.sug.skip')}
                        </label>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busy || !kept.length}
                    onClick={() => save.mutate(kept.map((s) => s.product._id), { onSuccess: () => setView('mine') })}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[var(--brand)] px-3.5 text-xs font-bold text-[var(--brand-fg)] disabled:opacity-50"
                  >
                    <SiteIcon name="check" size={13} />
                    {tr('products.sug.approve', { count: kept.length })}
                  </button>
                  <span className="text-[11px] text-[var(--fg-muted)]">{tr('products.sim.after')}</span>
                </div>
              </>
            ) : (
              <p className="mt-2 text-[11px] text-[var(--fg-muted)]">{tr('products.sim.empty')}</p>
            )
          ) : (
            <>
              <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
                {chosenList.map((p, i) => (
                  <div key={p._id} className="flex w-[8.75rem] shrink-0 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)]">
                    <button type="button" onClick={() => onOpen(p)} title={p.name} className="text-start">
                      <span className="relative block">
                        <Thumb p={p} />
                        <span className="absolute start-1 top-1 rounded-md bg-[var(--brand)] px-1.5 text-[11px] font-bold leading-5 text-[var(--brand-fg)]">#{i + 1}</span>
                      </span>
                      <span className="block px-2 pt-1.5">
                        <span className="block truncate text-xs font-medium">{p.name}</span>
                        <span className="block text-[11px] tabular-nums text-[var(--fg-muted)]">{formatCurrency(p.price)}</span>
                      </span>
                    </button>
                    <span className="mt-1 flex items-center justify-between border-t border-[var(--border)] px-0.5 py-0.5">
                      <button type="button" disabled={busy || i === 0} onClick={() => move(i, i - 1)} aria-label={tr('products.board.moveLeft')} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] disabled:opacity-30">
                        <SiteIcon name="chevron-left" size={14} className="rtl:rotate-180" />
                      </button>
                      <button type="button" disabled={busy || i === chosenList.length - 1} onClick={() => move(i, i + 1)} aria-label={tr('products.board.moveRight')} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] disabled:opacity-30">
                        <SiteIcon name="chevron-right" size={14} className="rtl:rotate-180" />
                      </button>
                      <button type="button" disabled={busy} onClick={() => save.mutate(chosenIds.filter((x) => x !== p._id))} aria-label={tr('products.board.removeLabel')} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--danger)]">
                        <SiteIcon name="close" size={14} />
                      </button>
                    </span>
                  </div>
                ))}
                <button
                  type="button"
                  disabled={busy || chosenIds.length >= MAX_SIMILAR}
                  onClick={() => setAdding(true)}
                  className="flex min-h-[8.5rem] w-[8.75rem] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--border)] text-xs font-medium text-[var(--brand-text)] hover:border-[var(--brand)] disabled:opacity-40"
                >
                  <SiteIcon name="plus" size={18} />
                  {chosenIds.length >= MAX_SIMILAR ? tr('products.board.full', { max: MAX_SIMILAR }) : tr('products.add')}
                </button>
              </div>
              {chosenIds.length ? (
                <button type="button" disabled={busy} onClick={() => save.mutate([])} className="mt-1 text-[11px] font-medium text-[var(--brand-text)] hover:underline">
                  {tr('products.board.backAuto')}
                </button>
              ) : (
                <p className="mt-1 text-[11px] text-[var(--fg-muted)]">{tr('products.sim.noneYet')}</p>
              )}
            </>
          )}
          {busy ? <Spinner size="sm" /> : null}
        </div>
      ) : null}

      <Modal open={picking} onClose={() => setPicking(false)} title={tr('products.sim.pick')} size="md">
        <ProductSearch
          currentId={mainId}
          actionLabel={tr('products.sim.use')}
          saving={false}
          onSelect={(id) => {
            setMainId(id)
            setSkip(new Set())
            setView('suggest')
            setPicking(false)
          }}
        />
      </Modal>
      <Modal open={adding} onClose={() => setAdding(false)} title={tr('products.sim.title')} size="md">
        <ProductSearch
          currentId={mainId}
          chosenIds={chosenIds}
          actionLabel={tr('products.add')}
          saving={busy}
          onSelect={(id) => save.mutate([...chosenIds, id], { onSuccess: () => setAdding(false) })}
        />
      </Modal>
    </div>
  )
}
