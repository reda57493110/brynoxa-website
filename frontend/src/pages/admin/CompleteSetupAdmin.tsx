import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { categoriesApi } from '@/api/categoriesApi'
import { getErrorMessage } from '@/api/client'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { SafeImage } from '@/components/ui/SafeImage'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { Spinner } from '@/components/ui/Spinner'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/cn'
import { toast } from '@/store/toastStore'
import { en } from '@/i18n/en'
import type { Category, Product, SetupProductRef } from '@/types'

const MAX_ITEMS = 12
const OBJECT_ID = /^[a-f0-9]{24}$/i

type Row = { product: SetupProductRef; enabled: boolean }

function kindLabel(kind?: string) {
  if (!kind) return ''
  const key = kind.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase()) as keyof typeof en.setupKind
  return en.setupKind[key] ?? kind
}

/** Product from a list/search result → the compact shape used on this page. */
function toRef(p: Product): SetupProductRef {
  return {
    _id: p._id,
    name: p.name,
    sku: p.sku,
    slug: p.slug,
    image: p.images?.find((i) => i.isPrimary)?.url || p.images?.[0]?.url || '',
    price: p.price,
    stock: p.stock,
    isActive: p.isActive,
    category: typeof p.category === 'object' && p.category ? p.category.name : '',
  }
}

function Thumb({ src, size = 'md' }: { src?: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span
      className={cn(
        'shrink-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-muted)]',
        size === 'sm' ? 'h-9 w-9' : size === 'lg' ? 'h-16 w-16 rounded-xl' : 'h-11 w-11'
      )}
    >
      {src ? <SafeImage src={src} alt="" className="h-full w-full object-cover" /> : null}
    </span>
  )
}

function Availability({ p }: { p: SetupProductRef }) {
  if (!p.isActive) return <Badge variant="muted">Hidden</Badge>
  if (p.stock <= 0) return <Badge variant="danger">Out of stock</Badge>
  if (p.stock <= 3) return <Badge variant="warning">{p.stock} left</Badge>
  return <span className="text-[11px] tabular-nums text-[var(--fg-muted)]">{p.stock} in stock</span>
}

/** Search the catalog by name, SKU or product ID, and/or list a whole category. */
function useProductSearch(query: string, category: string) {
  const q = useDeferredValue(query.trim())
  return useQuery({
    queryKey: ['admin-setup-search', q, category],
    queryFn: async () => {
      if (OBJECT_ID.test(q)) {
        try {
          return [(await adminApi.products.get(q)).data.data]
        } catch {
          return []
        }
      }
      return (
        await adminApi.products.list({
          q: q.length >= 2 ? q : undefined,
          category: category || undefined,
          limit: category ? 60 : 12,
          sort: 'name',
        })
      ).data.data
    },
    enabled: q.length >= 2 || Boolean(category),
  })
}

/** "All · Laptops · Monitors…" — pick a category to list all its products. */
function CategoryChips({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const cats = useQuery({
    queryKey: ['categories', 'all'],
    queryFn: async () => (await categoriesApi.list(true)).data.data,
    staleTime: 5 * 60_000,
  })
  const list = (cats.data as Category[] | undefined) ?? []
  if (!list.length) return null
  const chip = (active: boolean) =>
    cn(
      'h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition',
      active
        ? 'border-transparent bg-[var(--brand)] text-[var(--brand-fg)]'
        : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--brand)] hover:text-[var(--fg)]'
    )
  return (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button type="button" className={chip(!value)} onClick={() => onChange('')}>
        All
      </button>
      {list.map((c) => (
        <button key={c._id} type="button" className={chip(value === c._id)} onClick={() => onChange(value === c._id ? '' : c._id)}>
          {c.name}
        </button>
      ))}
    </div>
  )
}

function SectionCard({ letter, title, aside, children }: { letter: string; title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 sm:rounded-2xl sm:p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] text-[11px] font-bold text-[var(--brand-text)]">
          {letter}
        </span>
        <h2 className="text-sm font-semibold sm:text-base">{title}</h2>
        {aside ? <div className="ms-auto">{aside}</div> : null}
      </div>
      {children}
    </section>
  )
}

/* ---------- A · Main product ---------- */

function MainProductPicker({ onPick }: { onPick: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const search = useProductSearch(query, category)
  const searching = query.trim().length >= 2 || Boolean(category)
  const configured = useQuery({
    queryKey: ['admin-setup-list'],
    queryFn: async () => (await adminApi.setup.list()).data.data,
  })

  return (
    <div className="space-y-3">
      <div className="relative">
        <SiteIcon name="search" size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, SKU or ID"
          className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-input)] ps-9 pe-3 text-sm outline-none ring-brand"
        />
      </div>
      <CategoryChips value={category} onChange={setCategory} />
      {searching ? (
        <ul className="max-h-[26rem] divide-y divide-[var(--border)] overflow-y-auto rounded-xl border border-[var(--border)]">
          {search.isLoading ? (
            <li className="flex justify-center py-4"><Spinner /></li>
          ) : search.data?.length ? (
            search.data.map((p) => (
              <li key={p._id}>
                <button type="button" onClick={() => onPick(p._id)} className="flex w-full items-center gap-3 px-3 py-2 text-start hover:bg-[var(--bg-muted)]">
                  <Thumb src={toRef(p).image} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.name}</span>
                    <span className="block truncate text-[11px] text-[var(--fg-muted)]">
                      {p.sku} · {toRef(p).category || '—'} · {formatCurrency(p.price)}
                    </span>
                  </span>
                  <SiteIcon name="chevron-right" size={14} className="shrink-0 text-[var(--fg-muted)]" />
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-3 text-sm text-[var(--fg-muted)]">No product found.</li>
          )}
        </ul>
      ) : null}

      <div>
        <p className="mb-1.5 text-xs font-medium text-[var(--fg-muted)]">Already set up</p>
        {configured.isLoading ? (
          <div className="flex justify-center py-4"><Spinner /></div>
        ) : configured.data?.length ? (
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {configured.data.map((row) => (
              <li key={row._id}>
                <button
                  type="button"
                  onClick={() => onPick(row._id)}
                  className="flex w-full items-center gap-2.5 rounded-xl border border-[var(--border)] p-2 text-start transition hover:border-[var(--brand)]"
                >
                  <Thumb src={row.image} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{row.name}</span>
                    <span className="block truncate text-[11px] text-[var(--fg-muted)]">
                      {row.enabled} product{row.enabled === 1 ? '' : 's'}{row.fillWithAutomatic ? ' + automatic' : ''}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-[var(--fg-muted)]">None yet</p>
        )}
      </div>
    </div>
  )
}

/* ---------- Page ---------- */

export function CompleteSetupAdmin() {
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const productId = params.get('product') || ''
  const [rows, setRows] = useState<Row[]>([])
  const [fill, setFill] = useState(false)
  const [addQuery, setAddQuery] = useState('')
  const [addCategory, setAddCategory] = useState('')
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [pendingSwitch, setPendingSwitch] = useState<string | null>(null)
  const addSearch = useProductSearch(addQuery, addCategory)
  const addSearching = addQuery.trim().length >= 2 || Boolean(addCategory)

  const detail = useQuery({
    queryKey: ['admin-setup', productId],
    queryFn: async () => (await adminApi.setup.get(productId)).data.data,
    enabled: Boolean(productId),
  })

  // Load the saved list into the editor
  const savedKey = detail.data ? JSON.stringify({ i: detail.data.items.map((r) => [r.product._id, r.enabled]), f: detail.data.fillWithAutomatic }) : ''
  useEffect(() => {
    if (!detail.data) return
    setRows(detail.data.items)
    // No picks yet: start with "only my products"; the switch only matters once there are some
    setFill(detail.data.items.length ? detail.data.fillWithAutomatic : false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey])

  const currentKey = JSON.stringify({ i: rows.map((r) => [r.product._id, r.enabled]), f: rows.length ? fill : detail.data?.fillWithAutomatic })
  const dirty = Boolean(detail.data) && currentKey !== savedKey && !(rows.length === 0 && detail.data!.items.length === 0)

  // Don't lose unsaved changes when leaving the page
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const save = useMutation({
    mutationFn: () =>
      adminApi.setup.save(productId, {
        items: rows.map((r) => ({ productId: r.product._id, enabled: r.enabled })),
        fillWithAutomatic: fill,
      }),
    onSuccess: (res) => {
      qc.setQueryData(['admin-setup', productId], res.data.data)
      void qc.invalidateQueries({ queryKey: ['admin-setup-list'] })
      void qc.invalidateQueries({ queryKey: ['products', 'recommendations', productId] })
      toast.success('Saved')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const selectProduct = (id: string) => {
    if (dirty && id !== productId) {
      setPendingSwitch(id)
      return
    }
    setParams(id ? { product: id } : {})
    setAddQuery('')
    setAddCategory('')
  }

  const ids = useMemo(() => new Set(rows.map((r) => r.product._id)), [rows])
  const full = rows.length >= MAX_ITEMS
  const add = (p: SetupProductRef) => {
    if (p._id === productId || ids.has(p._id) || full) return
    setRows((list) => [...list, { product: p, enabled: true }])
  }
  const move = (from: number, to: number) =>
    setRows((list) => {
      if (to < 0 || to >= list.length) return list
      const next = [...list]
      const [r] = next.splice(from, 1)
      next.splice(to, 0, r)
      return next
    })

  const main = detail.data?.product
  const automatic = detail.data?.automatic

  return (
    <div className={cn('min-w-0 space-y-3 sm:space-y-4', dirty && 'pb-20')}>
      <AdminHeader
        title="Complete your setup"
        description="Pick the products shown with each product."
      />

      {/* A · Main product */}
      <SectionCard
        letter="A"
        title="Product"
        aside={
          main ? (
            <button type="button" onClick={() => selectProduct('')} className="text-xs font-medium text-[var(--brand-text)] hover:underline">
              Change
            </button>
          ) : null
        }
      >
        {!productId ? (
          <MainProductPicker onPick={selectProduct} />
        ) : detail.isLoading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : detail.isError || !main ? (
          <QueryErrorState title="Product not found" description={getErrorMessage(detail.error)} onRetry={() => detail.refetch()} />
        ) : (
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <Thumb src={main.image} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{main.name}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--fg-muted)]">
                <span>{main.category || '—'}</span>
                {automatic && !main.category.toLowerCase().startsWith(kindLabel(automatic.kind).toLowerCase()) ? (
                  <span>· {kindLabel(automatic.kind)}</span>
                ) : null}
                <span className="tabular-nums">· {formatCurrency(main.price)}</span>
                <Availability p={main} />
              </div>
            </div>
            <div className="flex w-full shrink-0 gap-2 sm:w-auto">
              <Link to={`/product/${main.slug}`} target="_blank" className="inline-flex h-8 items-center gap-1 rounded-full border border-[var(--border)] px-3 text-xs font-medium hover:border-[var(--brand)]">
                <SiteIcon name="external" size={12} /> View
              </Link>
              <Link to={`/admin/products/${main._id}/edit`} className="inline-flex h-8 items-center gap-1 rounded-full border border-[var(--border)] px-3 text-xs font-medium hover:border-[var(--brand)]">
                <SiteIcon name="pencil" size={12} /> Edit
              </Link>
            </div>
          </div>
        )}
      </SectionCard>

      {main && detail.data ? (
        <div className="grid min-w-0 gap-3 sm:gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          {/* B · Selected recommendations */}
          <SectionCard letter="B" title="Recommendations" aside={<span className="text-xs tabular-nums text-[var(--fg-muted)]">{rows.length}/{MAX_ITEMS}</span>}>
            {rows.length ? (
              <>
                <ol className="space-y-1.5">
                  {rows.map((r, i) => (
                    <li
                      key={r.product._id}
                      draggable
                      onDragStart={() => setDragIndex(i)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragIndex !== null) move(dragIndex, i)
                        setDragIndex(null)
                      }}
                      onDragEnd={() => setDragIndex(null)}
                      className={cn(
                        'flex min-w-0 items-center gap-2 rounded-xl border bg-[var(--bg)] p-2 transition',
                        dragIndex === i ? 'border-[var(--brand)] opacity-60' : 'border-[var(--border)]',
                        !r.enabled && 'opacity-55'
                      )}
                    >
                      <span className="hidden cursor-grab select-none text-[var(--border)] sm:block" aria-hidden="true">⋮⋮</span>
                      <span className="w-5 shrink-0 text-center text-xs font-bold tabular-nums text-[var(--fg-muted)]">{i + 1}</span>
                      <Thumb src={r.product.image} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{r.product.name}</span>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--fg-muted)]">
                          <span className="truncate">{r.product.category || '—'}</span>
                          <span className="tabular-nums">{formatCurrency(r.product.price)}</span>
                          <Availability p={r.product} />
                        </span>
                      </span>
                      <label className="flex shrink-0 cursor-pointer items-center" title={r.enabled ? 'Shown — click to switch off' : 'Off — click to show'}>
                        <input
                          type="checkbox"
                          className="peer sr-only"
                          checked={r.enabled}
                          onChange={(e) => setRows((list) => list.map((x, j) => (j === i ? { ...x, enabled: e.target.checked } : x)))}
                          aria-label={`Show ${r.product.name}`}
                        />
                        <span className="relative h-5 w-9 rounded-full bg-[var(--border)] transition peer-checked:bg-[var(--success)] after:absolute after:start-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-4 rtl:peer-checked:after:-translate-x-4" />
                      </label>
                      <span className="flex shrink-0 flex-col">
                        <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Move up" className="h-5 w-7 text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] disabled:opacity-30">▲</button>
                        <button type="button" onClick={() => move(i, i + 1)} disabled={i === rows.length - 1} aria-label="Move down" className="h-5 w-7 text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] disabled:opacity-30">▼</button>
                      </span>
                      <button
                        type="button"
                        onClick={() => setRows((list) => list.filter((_, j) => j !== i))}
                        aria-label={`Remove ${r.product.name}`}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:text-[var(--danger)]"
                      >
                        <SiteIcon name="close" size={14} />
                      </button>
                    </li>
                  ))}
                </ol>
                <label className="mt-3 flex cursor-pointer items-center gap-2 px-1 text-xs text-[var(--fg-muted)]" title="Off: only these products, in this order">
                  <input type="checkbox" className="accent-[var(--brand)]" checked={fill} onChange={(e) => setFill(e.target.checked)} />
                  Also show automatic suggestions
                </label>
              </>
            ) : (
              <div className="space-y-3">
                {automatic?.items.length ? (
                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-[var(--fg-muted)]">Automatic for now</p>
                      <button
                        type="button"
                        onClick={() => automatic.items.slice(0, MAX_ITEMS).forEach((p) => add(toRef(p)))}
                        className="text-xs font-medium text-[var(--brand-text)] hover:underline"
                      >
                        Use all
                      </button>
                    </div>
                    <ul className="space-y-1.5">
                      {automatic.items.map((p) => (
                        <li key={p._id} className="flex items-center gap-2 rounded-xl border border-[var(--border)] p-2">
                          <Thumb src={toRef(p).image} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[10px] font-semibold uppercase tracking-wide text-[var(--brand-text)]">{kindLabel(p.setupKind)}</span>
                            <span className="block truncate text-sm">{p.name}</span>
                          </span>
                          <Button size="sm" variant="outline" className="h-8" onClick={() => add(toRef(p))}>
                            <SiteIcon name="plus" size={13} /> Add
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--fg-muted)]">Nothing yet — add products from the list.</p>
                )}
              </div>
            )}
          </SectionCard>

          {/* C · Add products */}
          <SectionCard letter="C" title="Add products">
            <div className="relative">
              <SiteIcon name="search" size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" />
              <input
                value={addQuery}
                onChange={(e) => setAddQuery(e.target.value)}
                placeholder="Search by name, SKU or ID"
                className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-input)] ps-9 pe-3 text-sm outline-none ring-brand"
              />
            </div>
            <div className="mt-2">
              <CategoryChips value={addCategory} onChange={setAddCategory} />
            </div>
            {addSearching ? (
              <ul className="mt-2 max-h-[30rem] divide-y divide-[var(--border)] overflow-y-auto rounded-xl border border-[var(--border)]">
                {addSearch.isLoading ? (
                  <li className="flex justify-center py-4"><Spinner /></li>
                ) : addSearch.data?.length ? (
                  addSearch.data.map((p) => {
                    const ref = toRef(p)
                    const self = p._id === productId
                    const added = ids.has(p._id)
                    return (
                      <li key={p._id} className={cn('flex items-center gap-2.5 px-2.5 py-2', (self || added) && 'bg-[var(--bg-muted)]/60')}>
                        <Thumb src={ref.image} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{p.name}</span>
                          <span className="flex flex-wrap items-center gap-x-2 text-[11px] text-[var(--fg-muted)]">
                            <span className="truncate">{ref.category || '—'}</span>
                            <span className="tabular-nums">{formatCurrency(p.price)}</span>
                            <Availability p={ref} />
                          </span>
                        </span>
                        {self ? (
                          <span className="shrink-0 text-[11px] text-[var(--fg-muted)]">This product</span>
                        ) : added ? (
                          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-[var(--success)]">
                            <SiteIcon name="check" size={12} /> Added
                          </span>
                        ) : (
                          <Button size="sm" variant="outline" className="h-8 shrink-0" disabled={full} onClick={() => add(ref)}>
                            <SiteIcon name="plus" size={13} /> Add
                          </Button>
                        )}
                      </li>
                    )
                  })
                ) : (
                  <li className="px-3 py-3 text-sm text-[var(--fg-muted)]">No product found.</li>
                )}
              </ul>
            ) : null}
          </SectionCard>
        </div>
      ) : null}

      {/* Save bar */}
      {dirty ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.08)] lg:start-64">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <span className="text-xs font-medium text-[var(--warning)]">● Unsaved changes</span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  if (!detail.data) return
                  setRows(detail.data.items)
                  setFill(detail.data.fillWithAutomatic)
                }}
                disabled={save.isPending}
              >
                Cancel
              </Button>
              <Button onClick={() => save.mutate()} loading={save.isPending}>
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingSwitch !== null)}
        title="Discard changes?"
        description="They are not saved yet."
        confirmLabel="Discard"
        onClose={() => setPendingSwitch(null)}
        onConfirm={() => {
          const next = pendingSwitch ?? ''
          setPendingSwitch(null)
          if (detail.data) setRows(detail.data.items)
          setParams(next ? { product: next } : {})
          setAddQuery('')
          setAddCategory('')
    setAddCategory('')
        }}
      />
    </div>
  )
}
