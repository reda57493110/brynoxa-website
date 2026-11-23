import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { settingsApi } from '@/api/settingsApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { SiteIcon, type SiteIconName } from '@/components/ui/SiteIcon'
import { SIGNATURE_BRAND } from '@/hooks/useHomeRows'
import { BUDGETS, HOME_ROW_LIMIT, inBudget } from '@/lib/homeRows'
import { setupsFor, type SetupId } from '@/lib/setups'
import { cn } from '@/lib/cn'
import { toast } from '@/store/toastStore'
import { at } from '@/i18n/admin'
import { useAdminT } from '@/store/adminLangStore'
import type { Product } from '@/types'

type Tone = 'on' | 'off' | 'warn'

export type AutoPlace = { key: string; icon: SiteIconName; title: string; status: string; tone: Tone; fix?: { label: string; to?: string; addTo?: 'new' | 'deals' } }

const amount = (n: number) => new Intl.NumberFormat('en-US').format(n)

/** A setup's name for staff, in the admin language */
export const setupLabel = (id: SetupId) => at(`products.setup.${id}`)

/** A budget band's name ("Under 5,000 DH"…), in the admin language */
export const budgetLabel = (b: { min?: number; max?: number }) =>
  b.min === undefined ? at('products.under', { amount: amount(b.max!) }) : b.max === undefined ? at('products.over', { amount: amount(b.min) }) : `${amount(b.min)} – ${amount(b.max)} DH`

/**
 * Where a product shows by itself on the site (the sections that fill themselves), and why not
 * when it does not — with the fix. Same rules as the shop: Active, in stock, an old price for
 * the deals, brand Brynoxa for Signature, price for the budget, category / ticks for setups.
 * A section whose list was chosen by hand in Admin only shows the products in that list.
 * Texts in the admin language (at(), read when called).
 */
export function autoPlacesOf(p: Product, homeRows: Partial<Record<string, string[]>> | undefined): AutoPlace[] {
  const out: AutoPlace[] = []
  const category = typeof p.category === 'object' && p.category ? p.category : null
  const brandSlug = typeof p.brand === 'object' && p.brand ? p.brand.slug : ''
  const inStock = p.stock > 0
  const handPicked = (key: string) => Boolean(homeRows?.[key]?.length)
  const inList = (key: string) => Boolean(homeRows?.[key]?.includes(p._id))

  if (!p.isActive) {
    return [{ key: 'hidden', icon: 'alert', title: at('products.hidden'), status: at('products.auto.notOnSite'), tone: 'warn', fix: { label: at('products.edit'), to: `/admin/products/${p._id}/edit` } }]
  }

  out.push({ key: 'shop', icon: 'cart', title: at('products.auto.shopCat'), status: category ? at('products.auto.yesWith', { value: category.name }) : at('products.yes'), tone: 'on' })

  if (!inStock) {
    out.push({
      key: 'stock',
      icon: 'alert',
      title: at('products.auto.stock0'),
      status: at('products.auto.stockNote'),
      tone: 'warn',
      fix: { label: at('products.auto.addStock'), to: `/admin/inventory/products/${p._id}` },
    })
  }

  // New arrivals (Our selection tab)
  if (handPicked('new')) {
    out.push(
      inList('new')
        ? { key: 'new', icon: 'clock', title: at('products.newArrivals'), status: at('products.auto.inList'), tone: inStock ? 'on' : 'warn' }
        : { key: 'new', icon: 'clock', title: at('products.newArrivals'), status: at('products.auto.byHand'), tone: 'off', fix: { label: at('products.auto.addFirst'), addTo: 'new' } }
    )
  } else {
    out.push({ key: 'new', icon: 'clock', title: at('products.newArrivals'), status: inStock ? at('products.auto.newestFirst') : at('products.auto.afterStock'), tone: inStock ? 'on' : 'off' })
  }

  // Deals of the moment
  const onSale = p.compareAtPrice != null && p.compareAtPrice > p.price
  if (!onSale) {
    out.push({ key: 'deals', icon: 'tag', title: at('products.dealsMoment'), status: at('products.auto.needsOldPrice'), tone: 'off', fix: { label: at('products.auto.setOldPrice'), to: `/admin/products/${p._id}/edit` } })
  } else if (handPicked('deals')) {
    out.push(
      inList('deals')
        ? { key: 'deals', icon: 'tag', title: at('products.dealsMoment'), status: at('products.auto.inList'), tone: inStock ? 'on' : 'warn' }
        : { key: 'deals', icon: 'tag', title: at('products.dealsMoment'), status: at('products.auto.byHand'), tone: 'off', fix: { label: at('products.add'), addTo: 'deals' } }
    )
  } else {
    out.push({ key: 'deals', icon: 'tag', title: at('products.dealsMoment'), status: inStock ? at('products.auto.yesWith', { value: `−${Math.round((1 - p.price / p.compareAtPrice!) * 100)}%` }) : at('products.auto.afterStock'), tone: inStock ? 'on' : 'off' })
  }

  // Shop by budget
  const band = BUDGETS.find((b) => inBudget(p.price, b))
  if (band) {
    const label = budgetLabel(band)
    out.push({ key: 'budget', icon: 'banknote', title: at('products.shopByBudget'), status: inStock ? at('products.auto.yesWith', { value: label }) : at('products.auto.afterStockWith', { value: label }), tone: inStock ? 'on' : 'off' })
  }

  // Pick your setup
  const setups = setupsFor(p as never)
  out.push({
    key: 'setups',
    icon: 'layers',
    title: at('products.pickSetup'),
    status: setups.length ? `${inStock ? at('products.yes') : at('products.auto.afterStock')} · ${setups.map((s) => setupLabel(s)).join(', ')}` : at('products.auto.tickSetup'),
    tone: setups.length && inStock ? 'on' : 'off',
    fix: setups.length ? undefined : { label: at('products.auto.choose'), to: `/admin/products/${p._id}/edit` },
  })

  // Brynoxa Signature
  if (brandSlug === SIGNATURE_BRAND || inList('signature')) {
    out.push({ key: 'signature', icon: 'star', title: at('products.signature'), status: handPicked('signature') && !inList('signature') ? at('products.auto.byHand') : inStock ? at('products.yes') : at('products.auto.afterStock'), tone: inStock && (!handPicked('signature') || inList('signature')) ? 'on' : 'off' })
  }

  out.push({ key: 'best', icon: 'package-check', title: at('products.bestSellers'), status: at('products.auto.whenSells'), tone: 'off' })
  return out
}

/** The list above, inside the placement window (opened by itself after a new product is saved). */
export function ProductAutoPlaces({ product }: { product: Product }) {
  const qc = useQueryClient()
  const tr = useAdminT()
  const settings = useQuery({ queryKey: ['settings'], queryFn: async () => (await settingsApi.get()).data.data, staleTime: 60_000 })
  const homeRows = settings.data?.homeRows as Partial<Record<string, string[]>> | undefined
  const add = useMutation({
    mutationFn: (key: 'new' | 'deals') => adminApi.settings.update({ homeRows: { [key]: [product._id, ...(homeRows?.[key] ?? [])].slice(0, HOME_ROW_LIMIT) } }),
    onSuccess: () => {
      for (const k of [['settings'], ['admin-settings'], ['products'], ['admin-products']]) qc.invalidateQueries({ queryKey: k })
      toast.success(tr('products.auto.homeUpdated'))
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const places = autoPlacesOf(product, homeRows)

  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">{tr('products.auto.heading')}</p>
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
