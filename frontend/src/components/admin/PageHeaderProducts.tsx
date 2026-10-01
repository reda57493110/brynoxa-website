import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { SafeImage } from '@/components/ui/SafeImage'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { useToastStore } from '@/store/toastStore'
import { HERO_NONE, useHeroProduct } from '@/hooks/useHeroProduct'
import { formatCurrency } from '@/lib/format'
import { optimizedImageUrl } from '@/lib/image'
import type { HeroPage, Product } from '@/types'

const PAGES: { page: HeroPage; label: string; path: string }[] = [
  { page: 'shop', label: 'Shop page', path: '/shop' },
]

function primaryImage(p: Product) {
  return p.images?.find((i) => i.isPrimary)?.url || p.images?.[0]?.url
}

function Thumb({ product }: { product?: Product | null }) {
  const img = product ? primaryImage(product) : undefined
  return (
    <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-muted)]">
      {img ? (
        <SafeImage src={optimizedImageUrl(img, 240)} alt="" className="h-full w-full object-cover" />
      ) : (
        <SiteIcon name="layers" size={18} className="text-[var(--fg-muted)]" />
      )}
    </div>
  )
}

export function PageHeaderProducts({ value }: { value?: Partial<Record<HeroPage, string>> }) {
  const qc = useQueryClient()
  const toast = useToastStore((s) => s.push)
  const [picking, setPicking] = useState<HeroPage | null>(null)

  const save = useMutation({
    mutationFn: (next: { page: HeroPage; id: string }) =>
      adminApi.settings.update({ pageHeroProducts: { [next.page]: next.id } }),
    onSuccess: (_res, next) => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      qc.invalidateQueries({ queryKey: ['hero-product'] })
      qc.invalidateQueries({ queryKey: ['hero-auto-products'] })
      const label = PAGES.find((p) => p.page === next.page)?.label ?? 'Page'
      toast(
        next.id === HERO_NONE
          ? `${label} header now shows its photo`
          : next.id
            ? `${label} header updated`
            : `${label} header set back to automatic`,
        'success',
      )
      setPicking(null)
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  })

  return (
    <ul className="space-y-3">
      {PAGES.map(({ page, label, path }) => (
        <PageRow
          key={page}
          page={page}
          label={label}
          path={path}
          setting={value?.[page] || ''}
          picking={picking === page}
          saving={save.isPending && save.variables?.page === page}
          onPick={() => setPicking(picking === page ? null : page)}
          onSelect={(id) => save.mutate({ page, id })}
          onRemove={() => save.mutate({ page, id: HERO_NONE })}
          onAutomatic={() => save.mutate({ page, id: '' })}
        />
      ))}
    </ul>
  )
}

function PageRow({
  page,
  label,
  path,
  setting,
  picking,
  saving,
  onPick,
  onSelect,
  onRemove,
  onAutomatic,
}: {
  page: HeroPage
  label: string
  path: string
  setting: string
  picking: boolean
  saving: boolean
  onPick: () => void
  onSelect: (id: string) => void
  onRemove: () => void
  onAutomatic: () => void
}) {
  const hidden = setting === HERO_NONE
  const productId = hidden ? '' : setting
  const current = useQuery({
    queryKey: ['admin-product', productId],
    queryFn: async () => (await adminApi.products.get(productId)).data.data,
    enabled: Boolean(productId),
    retry: false,
  })
  const shown = useHeroProduct(page)
  const product = productId ? current.data : null
  const missing = Boolean(productId) && current.isError
  const autoProduct = !shown.pinned ? shown.product : null

  return (
    <li className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Thumb product={product || autoProduct} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">{label}</p>
          {hidden ? (
            <>
              <p className="font-medium">No product</p>
              <p className="mt-0.5 text-sm text-[var(--fg-muted)]">
                The header shows its normal photo. Choose a product, or use automatic to show your
                first featured product.
              </p>
            </>
          ) : productId && current.isPending ? (
            <p className="text-sm text-[var(--fg-muted)]">Loading…</p>
          ) : product ? (
            <>
              <p className="truncate font-medium">{product.name}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold tabular-nums">{formatCurrency(product.price)}</span>
                {!product.isActive ? (
                  <Badge variant="danger">Hidden — a featured product shows instead</Badge>
                ) : null}
              </div>
            </>
          ) : autoProduct ? (
            <>
              <p className="truncate font-medium">{autoProduct.name}</p>
              <p className="mt-0.5 text-sm text-[var(--fg-muted)]">
                {missing ? 'The chosen product was deleted, so this' : 'Automatic — this'} is your
                first featured product. Choose a different one, or remove it to show the photo.
              </p>
            </>
          ) : missing ? (
            <p className="text-sm text-[var(--fg-muted)]">
              Product was deleted — a featured product shows instead.
            </p>
          ) : (
            <p className="text-sm text-[var(--fg-muted)]">
              Automatic — showing one of your featured products
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant={picking ? 'ghost' : 'outline'} onClick={onPick}>
            {picking ? 'Cancel' : productId ? 'Change' : 'Choose product'}
          </Button>
          {hidden || productId ? (
            <Button size="sm" variant="ghost" onClick={onAutomatic} loading={saving && !picking && hidden}>
              Use automatic
            </Button>
          ) : null}
          {!hidden && (product || autoProduct) ? (
            <Button size="sm" variant="ghost" onClick={onRemove} loading={saving && !picking && !hidden}>
              Remove
            </Button>
          ) : null}
          <a
            href={path}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 px-2 text-sm text-[var(--brand-text)] hover:underline"
          >
            View page <SiteIcon name="external" size={13} />
          </a>
        </div>
      </div>

      {picking ? <ProductSearch currentId={productId} saving={saving} onSelect={onSelect} /> : null}
    </li>
  )
}

function ProductSearch({
  currentId,
  saving,
  onSelect,
}: {
  currentId: string
  saving: boolean
  onSelect: (id: string) => void
}) {
  const [q, setQ] = useState('')
  const results = useQuery({
    queryKey: ['admin-products', 'hero-picker', q],
    queryFn: async () =>
      (await adminApi.products.list({ q: q.trim() || undefined, isActive: true, limit: 8 })).data.data,
    placeholderData: keepPreviousData,
  })

  return (
    <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
      <Input
        placeholder="Search your products by name or SKU"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
      />
      {results.isPending ? (
        <div className="flex justify-center py-4">
          <Spinner />
        </div>
      ) : results.data?.length ? (
        <ul className="max-h-80 space-y-2 overflow-y-auto">
          {results.data.map((p) => {
            const selected = p._id === currentId
            return (
              <li
                key={p._id}
                className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-2.5"
              >
                <Thumb product={p} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-[var(--fg-muted)] tabular-nums">
                    {formatCurrency(p.price)} · {p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={selected ? 'ghost' : 'primary'}
                  disabled={selected || saving}
                  onClick={() => onSelect(p._id)}
                >
                  {selected ? 'Current' : 'Use this'}
                </Button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="py-2 text-sm text-[var(--fg-muted)]">No active products match “{q}”.</p>
      )}
    </div>
  )
}
