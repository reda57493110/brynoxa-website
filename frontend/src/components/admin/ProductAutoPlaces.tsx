import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { settingsApi } from '@/api/settingsApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { SiteIcon, type SiteIconName } from '@/components/ui/SiteIcon'
import { SIGNATURE_BRAND } from '@/hooks/useHomeRows'
import { BUDGETS, inBudget } from '@/lib/homeRows'
import { SETUP_ADMIN_LABEL, setupsFor } from '@/lib/setups'
import { cn } from '@/lib/cn'
import { toast } from '@/store/toastStore'
import type { Product } from '@/types'

type Tone = 'on' | 'off' | 'warn'

export type AutoPlace = { key: string; icon: SiteIconName; title: string; status: string; tone: Tone; fix?: { label: string; to?: string; addTo?: 'new' | 'deals' } }

const amount = (n: number) => new Intl.NumberFormat('en-US').format(n)

/**
 * Where a product shows by itself on the site (the sections that fill themselves), and why not
 * when it does not — with the fix. Same rules as the shop: Active, in stock, an old price for
 * the deals, brand Brynoxa for Signature, price for the budget, category / ticks for setups.
 * A section whose list was chosen by hand in Admin only shows the products in that list.
 */
export function autoPlacesOf(p: Product, homeRows: Partial<Record<string, string[]>> | undefined): AutoPlace[] {
  const out: AutoPlace[] = []
  const category = typeof p.category === 'object' && p.category ? p.category : null
  const brandSlug = typeof p.brand === 'object' && p.brand ? p.brand.slug : ''
  const inStock = p.stock > 0
  const handPicked = (key: string) => Boolean(homeRows?.[key]?.length)
  const inList = (key: string) => Boolean(homeRows?.[key]?.includes(p._id))

  if (!p.isActive) {
    return [{ key: 'hidden', icon: 'alert', title: 'Hidden', status: 'Not on the site at all (status Hidden).', tone: 'warn', fix: { label: 'Edit', to: `/admin/products/${p._id}/edit` } }]
  }

  out.push({ key: 'shop', icon: 'cart', title: 'Shop and its category page', status: category ? `Yes · ${category.name}` : 'Yes', tone: 'on' })

  if (!inStock) {
    out.push({
      key: 'stock',
      icon: 'alert',
      title: 'Stock 0',
      status: 'Shown as out of stock, and left out of New arrivals, Deals, budgets, setups and Signature (they list products in stock).',
      tone: 'warn',
      fix: { label: 'Add stock', to: `/admin/inventory/products/${p._id}` },
    })
  }

  // New arrivals (Our selection tab)
  if (handPicked('new')) {
    out.push(
      inList('new')
        ? { key: 'new', icon: 'clock', title: 'New arrivals', status: 'Yes · in your list', tone: inStock ? 'on' : 'warn' }
        : { key: 'new', icon: 'clock', title: 'New arrivals', status: 'No · this list was chosen by hand', tone: 'off', fix: { label: 'Add #1', addTo: 'new' } }
    )
  } else {
    out.push({ key: 'new', icon: 'clock', title: 'New arrivals', status: inStock ? 'Yes · the newest come first (unless already in Deals / Top picks)' : 'After stock is added', tone: inStock ? 'on' : 'off' })
  }

  // Deals of the moment
  const onSale = p.compareAtPrice != null && p.compareAtPrice > p.price
  if (!onSale) {
    out.push({ key: 'deals', icon: 'tag', title: 'Deals of the moment', status: 'No · needs an old price above the price', tone: 'off', fix: { label: 'Set old price', to: `/admin/products/${p._id}/edit` } })
  } else if (handPicked('deals')) {
    out.push(
      inList('deals')
        ? { key: 'deals', icon: 'tag', title: 'Deals of the moment', status: 'Yes · in your list', tone: inStock ? 'on' : 'warn' }
        : { key: 'deals', icon: 'tag', title: 'Deals of the moment', status: 'No · this list was chosen by hand', tone: 'off', fix: { label: 'Add', addTo: 'deals' } }
    )
  } else {
    out.push({ key: 'deals', icon: 'tag', title: 'Deals of the moment', status: inStock ? `Yes · −${Math.round((1 - p.price / p.compareAtPrice!) * 100)}%` : 'After stock is added', tone: inStock ? 'on' : 'off' })
  }

  // Shop by budget
  const band = BUDGETS.find((b) => inBudget(p.price, b))
  if (band) {
    const label = band.min === undefined ? `Under ${amount(band.max!)} DH` : band.max === undefined ? `Over ${amount(band.min)} DH` : `${amount(band.min)} – ${amount(band.max)} DH`
    out.push({ key: 'budget', icon: 'banknote', title: 'Shop by budget', status: inStock ? `Yes · ${label}` : `${label} · after stock is added`, tone: inStock ? 'on' : 'off' })
  }

  // Pick your setup
  const setups = setupsFor(p as never)
  out.push({
    key: 'setups',
    icon: 'layers',
    title: 'Pick your setup',
    status: setups.length ? `${inStock ? 'Yes' : 'After stock is added'} · ${setups.map((s) => SETUP_ADMIN_LABEL[s]).join(', ')}` : 'No · tick a setup in the product form',
    tone: setups.length && inStock ? 'on' : 'off',
    fix: setups.length ? undefined : { label: 'Choose', to: `/admin/products/${p._id}/edit` },
  })

  // Brynoxa Signature
  if (brandSlug === SIGNATURE_BRAND || inList('signature')) {
    out.push({ key: 'signature', icon: 'star', title: 'Brynoxa Signature', status: handPicked('signature') && !inList('signature') ? 'No · this list was chosen by hand' : inStock ? 'Yes' : 'After stock is added', tone: inStock && (!handPicked('signature') || inList('signature')) ? 'on' : 'off' })
  }

  out.push({ key: 'best', icon: 'package-check', title: 'Best sellers', status: 'When it sells', tone: 'off' })
  return out
}

/** The list above, inside the placement window (opened by itself after a new product is saved). */
export function ProductAutoPlaces({ product }: { product: Product }) {
  const qc = useQueryClient()
  const settings = useQuery({ queryKey: ['settings'], queryFn: async () => (await settingsApi.get()).data.data, staleTime: 60_000 })
  const homeRows = settings.data?.homeRows as Partial<Record<string, string[]>> | undefined
  const add = useMutation({
    mutationFn: (key: 'new' | 'deals') => adminApi.settings.update({ homeRows: { [key]: [product._id, ...(homeRows?.[key] ?? [])].slice(0, 12) } }),
    onSuccess: () => {
      for (const k of [['settings'], ['admin-settings'], ['products'], ['admin-products']]) qc.invalidateQueries({ queryKey: k })
      toast.success('Home page updated')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const places = autoPlacesOf(product, homeRows)

  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Where it shows by itself</p>
      <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] px-3">
        {places.map((x) => (
          <li key={x.key} className="flex min-w-0 items-center justify-between gap-2 py-2">
            <div className="flex min-w-0 items-start gap-2">
              <SiteIcon
                name={x.tone === 'on' ? 'check' : x.icon}
                size={15}
                className={cn('mt-0.5 shrink-0', x.tone === 'on' ? 'text-[var(--success)]' : x.tone === 'warn' ? 'text-[var(--warning)]' : 'text-[var(--fg-muted)]')}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium">{x.title}</p>
                <p className={cn('text-xs', x.tone === 'warn' ? 'text-[var(--warning)]' : 'text-[var(--fg-muted)]')}>{x.status}</p>
              </div>
            </div>
            {x.fix ? (
              x.fix.to ? (
                <Link to={x.fix.to} className="shrink-0 rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-semibold hover:border-[var(--brand)] hover:text-[var(--brand-text)]">
                  {x.fix.label}
                </Link>
              ) : (
                <Button size="sm" variant="outline" disabled={add.isPending} onClick={() => add.mutate(x.fix!.addTo!)}>
                  {x.fix.label}
                </Button>
              )
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
