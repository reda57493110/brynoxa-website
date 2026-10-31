import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { SiteIcon, type SiteIconName } from '@/components/ui/SiteIcon'
import { Spinner } from '@/components/ui/Spinner'
import { ADMIN_PAGES, dataQuery, matchPages, searchText } from '@/lib/adminSearch'
import { optimizedImageUrl } from '@/lib/image'
import { canOpenAdminPath } from '@/lib/permissions'
import { formatCurrency } from '@/lib/format'
import { orderStatusLabel } from '@/lib/admin'
import { cn } from '@/lib/cn'
import { useAuthStore } from '@/store/authStore'

type Hit = { key: string; icon: SiteIconName; title: string; detail?: string; to: string; image?: string; more?: boolean }
type Group = { id: string; label: string; hits: Hit[]; loading?: boolean }

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

const RECENT_KEY = 'brynoxa-admin-search-recent'
type Recent = Pick<Hit, 'key' | 'icon' | 'title' | 'detail' | 'to' | 'image'>

function readRecent(userId?: string): Recent[] {
  try {
    const all = JSON.parse(localStorage.getItem(RECENT_KEY) || '{}') as Record<string, Recent[]>
    return (userId && all[userId]) || []
  } catch {
    return []
  }
}

function rememberRecent(userId: string | undefined, hit: Hit) {
  if (!userId || hit.more) return
  try {
    const all = JSON.parse(localStorage.getItem(RECENT_KEY) || '{}') as Record<string, Recent[]>
    const { key, icon, title, detail, to, image } = hit
    all[userId] = [{ key, icon, title, detail, to, image }, ...(all[userId] || []).filter((r) => r.key !== key)].slice(0, 6)
    localStorage.setItem(RECENT_KEY, JSON.stringify(all))
  } catch {
    /* storage unavailable: no recent list */
  }
}

/** The quick actions shown when nothing is typed yet (each only if the role can open it). */
const QUICK = ['Add an order', 'Add a product', 'Return & refund', 'Record a deposit', 'Receive stock', 'Add an expense']

/** The words typed, after a short pause (no request per key press). */
function useSettled(value: string, ms = 250) {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setSettled(value), ms)
    return () => window.clearTimeout(id)
  }, [value, ms])
  return settled
}

/**
 * Search the whole admin from the top bar (or Ctrl / ⌘ + K, or "/"): pages and settings, orders
 * (number, customer, phone), customers (name, email, phone), products (name, SKU), coupons,
 * inbox messages and staff. Each group only for staff who can open it. ↑ ↓ to move, Enter to open.
 */
export function AdminSearch() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setOpen(true)
      } else if (e.key === '/' && !typing && !open) {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      {/* Computers: a search field in the top bar */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-9 w-full max-w-md items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--fg-muted)] transition hover:border-[var(--brand)] md:flex"
      >
        <SiteIcon name="search" size={15} />
        <span className="min-w-0 flex-1 truncate text-start">Search orders, customers, products, settings…</span>
        <kbd className="rounded-md border border-[var(--border)] px-1.5 py-0.5 text-[10px] font-semibold">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
      </button>
      {/* Phones: an icon */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search the admin"
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)] md:hidden"
      >
        <SiteIcon name="search" size={17} />
      </button>
      {open ? createPortal(<SearchPanel onClose={() => setOpen(false)} />, document.body) : null}
    </>
  )
}

function SearchPanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const role = useAuthStore((s) => s.user?.role)
  const userId = useAuthStore((s) => s.user?._id)
  const can = (to: string) => canOpenAdminPath(role, to)
  const [recent] = useState(() => readRecent(userId))
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const query = useSettled(q.trim())
  // Orders, customers and products get the meaningful words only: "edit hp" looks up "hp"
  const lookup = dataQuery(query)
  const ready = lookup.length >= 2

  useEffect(() => {
    input.current?.focus()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const orders = useQuery({
    queryKey: ['admin-search', 'orders', lookup],
    queryFn: async () => (await adminApi.orders.list({ q: lookup, limit: 5 })).data.data,
    enabled: ready && can('/admin/orders'),
    staleTime: 30_000,
  })
  const customers = useQuery({
    queryKey: ['admin-search', 'customers', lookup],
    queryFn: async () => (await adminApi.customers.list({ q: lookup, limit: 5 })).data.data,
    enabled: ready && can('/admin/customers'),
    staleTime: 30_000,
  })
  const products = useQuery({
    queryKey: ['admin-search', 'products', lookup],
    queryFn: async () => (await adminApi.products.list({ q: lookup, limit: 5 })).data.data,
    enabled: ready && can('/admin/products'),
    staleTime: 30_000,
  })
  const staff = useQuery({
    queryKey: ['admin-search', 'staff', lookup],
    queryFn: async () => (await adminApi.users.list({ q: lookup, role: 'staff', limit: 5 })).data.data,
    enabled: ready && can('/admin/roles'),
    staleTime: 30_000,
  })
  // Short lists, loaded once while the search is open and filtered here
  const coupons = useQuery({
    queryKey: ['admin-coupons'],
    queryFn: async () => (await adminApi.coupons.list()).data.data,
    enabled: ready && can('/admin/coupons'),
    staleTime: 60_000,
  })
  const messages = useQuery({
    queryKey: ['admin-search', 'messages'],
    queryFn: async () => (await adminApi.messages.list({ limit: 50 })).data.data,
    enabled: ready && can('/admin/messages'),
    staleTime: 60_000,
  })

  const groups: Group[] = useMemo(() => {
    const words = searchText(lookup)
    const pageHit = (p: (typeof ADMIN_PAGES)[number]) => ({ key: `page-${p.label}`, icon: p.icon, title: p.label, detail: p.hint, to: p.to })
    const out: Group[] = []
    if (!query) {
      // Nothing typed yet: where you went last, and the usual jobs
      const mine = recent.filter((r) => can(r.to))
      if (mine.length) out.push({ id: 'recent', label: 'Recent', hits: mine.map((r) => ({ ...r, key: `recent-${r.key}` })) })
      out.push({
        id: 'quick',
        label: 'Quick actions',
        hits: ADMIN_PAGES.filter((p) => QUICK.includes(p.label) && can(p.to)).map(pageHit),
      })
      return out
    }
    const pages = matchPages(query).filter((p) => can(p.to)).slice(0, 5)
    if (pages.length) out.push({ id: 'pages', label: 'Pages, settings & actions', hits: pages.map(pageHit) })
    if (!ready) return out
    const seeAll = (label: string, to: string): Hit => ({ key: `more-${to}`, icon: 'search', title: label, to, more: true })
    if (can('/admin/orders'))
      out.push({
        id: 'orders',
        label: 'Orders',
        loading: orders.isFetching && !orders.data,
        hits: (orders.data ?? []).map((o): Hit => ({
          key: `order-${o._id}`,
          icon: 'cart',
          title: `#${o.orderNumber}`,
          detail: [
            typeof o.user === 'object' && o.user?.name ? o.user.name : o.shippingAddress?.fullName,
            formatCurrency(o.pricing.total),
            orderStatusLabel(o.orderStatus),
          ]
            .filter(Boolean)
            .join(' · '),
          to: `/admin/orders/${o._id}`,
        })).concat(orders.data && orders.data.length >= 5 ? [seeAll(`See all orders matching “${lookup}”`, `/admin/orders?q=${encodeURIComponent(lookup)}`)] : []),
      })
    if (can('/admin/customers'))
      out.push({
        id: 'customers',
        label: 'Customers',
        loading: customers.isFetching && !customers.data,
        hits: (customers.data ?? []).map((c): Hit => ({
          key: `customer-${c._id}`,
          icon: 'user',
          title: c.name,
          detail: [c.phone, c.email, c.companyName].filter(Boolean).join(' · '),
          to: `/admin/customers/${c._id}`,
        })).concat(customers.data && customers.data.length >= 5 ? [seeAll(`See all customers matching “${lookup}”`, `/admin/customers?q=${encodeURIComponent(lookup)}`)] : []),
      })
    if (can('/admin/products'))
      out.push({
        id: 'products',
        label: 'Products',
        loading: products.isFetching && !products.data,
        hits: (products.data ?? []).map((p): Hit => ({
          key: `product-${p._id}`,
          icon: 'package',
          title: p.name,
          detail: [p.sku, formatCurrency(p.price), `${p.stock} in stock`].filter(Boolean).join(' · '),
          to: `/admin/products/${p._id}/edit`,
          image: (p.images?.find((i) => i.isPrimary) ?? p.images?.[0])?.url,
        })).concat(products.data && products.data.length >= 5 ? [seeAll(`See all products matching “${lookup}”`, `/admin/products?q=${encodeURIComponent(lookup)}`)] : []),
      })
    if (can('/admin/coupons'))
      out.push({
        id: 'coupons',
        label: 'Coupons',
        loading: coupons.isFetching && !coupons.data,
        hits: (coupons.data ?? [])
          .filter((c) => searchText(c.code).includes(words))
          .slice(0, 5)
          .map((c) => ({
            key: `coupon-${c._id}`,
            icon: 'ticket',
            title: c.code,
            detail: c.type === 'percent' ? `${c.value}% off` : c.type === 'fixed' ? `${formatCurrency(c.value)} off` : 'Special prices',
            to: '/admin/coupons',
          })),
      })
    if (can('/admin/messages'))
      out.push({
        id: 'messages',
        label: 'Inbox',
        loading: messages.isFetching && !messages.data,
        hits: (messages.data ?? [])
          .filter((m) => searchText(`${m.name} ${m.email} ${m.subject} ${m.message}`).includes(words))
          .slice(0, 5)
          .map((m) => ({ key: `message-${m._id}`, icon: 'inbox', title: m.subject || m.name, detail: `${m.name} · ${m.email}`, to: '/admin/messages' })),
      })
    if (can('/admin/roles'))
      out.push({
        id: 'staff',
        label: 'Staff',
        loading: staff.isFetching && !staff.data,
        hits: (staff.data ?? []).map((u) => ({ key: `staff-${u._id}`, icon: 'shield', title: u.name, detail: `${u.email} · ${u.role}`, to: `/admin/roles/${u._id}` })),
      })
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, lookup, ready, role, recent, orders.data, orders.isFetching, customers.data, customers.isFetching, products.data, products.isFetching, coupons.data, coupons.isFetching, messages.data, messages.isFetching, staff.data, staff.isFetching])

  const shown = groups.filter((g) => g.hits.length || g.loading)
  const flat = shown.flatMap((g) => g.hits)
  const searching = shown.some((g) => g.loading) || q.trim() !== query

  useEffect(() => setActive(0), [query])
  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const go = (hit: Hit | undefined) => {
    if (!hit) return
    rememberRecent(userId, hit)
    onClose()
    navigate(hit.to)
  }

  let index = -1
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/50 px-3 pt-[8vh] backdrop-blur-sm sm:pt-[12vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label="Search the admin"
        className="flex max-h-[78vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg)] shadow-soft-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-4">
          <SiteIcon name="search" size={17} className="shrink-0 text-[var(--fg-muted)]" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose()
              else if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((a) => Math.min(a + 1, flat.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(a - 1, 0))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                go(flat[active])
              }
            }}
            placeholder="Search or type what you want to do (e.g. edit product, refund, 06…)"
            aria-label="Search"
            className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[var(--fg-muted)]"
          />
          {searching && q.trim().length >= 2 ? <Spinner size="sm" /> : null}
          <button type="button" onClick={onClose} className="rounded-md border border-[var(--border)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--fg-muted)]">
            Esc
          </button>
        </div>

        <div ref={list} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
          {shown.map((g) => (
            <section key={g.id} className="mb-1">
              <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">{g.label}</p>
              {g.loading && !g.hits.length ? (
                <p className="px-2 py-2 text-sm text-[var(--fg-muted)]">Searching…</p>
              ) : (
                g.hits.map((hit) => {
                  index += 1
                  const i = index
                  return (
                    <Row key={hit.key} hit={hit} words={q} index={i} active={i === active} onHover={() => setActive(i)} onPick={() => go(hit)} />
                  )
                })
              )}
            </section>
          ))}
          {q.trim().length >= 2 && !searching && !flat.length ? (
            <Empty>
              Nothing found for “{q.trim()}”.
              <span className="mt-1 block text-xs">
                Try an order number (BRX-…), a phone number, a customer’s name, a product name or SKU — or what you want to do, like
                “add order”, “refund”, “delivery fee”.
              </span>
            </Empty>
          ) : null}
          {q.trim().length === 1 ? <Empty>Type at least 2 letters to search orders, customers and products.</Empty> : null}
        </div>

        <p className="hidden border-t border-[var(--border)] px-4 py-2 text-[11px] text-[var(--fg-muted)] sm:block">
          ↑ ↓ to move · Enter to open · Esc to close · {isMac ? '⌘K' : 'Ctrl K'} or / from anywhere in the admin
        </p>
      </div>
    </div>
  )
}

/** The typed words in bold inside a result. */
function Marked({ text, words }: { text: string; words: string }) {
  const parts = words
    .trim()
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\function Row({ hit, index, active, onHover, onPick }: { hit: Hit; index: number; active: boolean; onHover: () => void; onPick: () => void }) {'))
  if (!parts.length) return <>{text}</>
  const rx = new RegExp(`(${parts.join('|')})`, 'ig')
  return (
    <>
      {text.split(rx).map((piece, i) =>
        i % 2 ? (
          <mark key={i} className="rounded-sm bg-[color-mix(in_srgb,var(--brand)_28%,transparent)] px-px text-inherit">
            {piece}
          </mark>
        ) : (
          piece
        )
      )}
    </>
  )
}

function Row({ hit, words, index, active, onHover, onPick }: { hit: Hit; words: string; index: number; active: boolean; onHover: () => void; onPick: () => void }) {
  return (
    <button
      type="button"
      data-index={index}
      onMouseMove={onHover}
      onClick={onPick}
      className={cn('flex w-full items-center gap-3 rounded-xl px-2 py-2 text-start', active ? 'bg-[color-mix(in_srgb,var(--brand)_12%,transparent)]' : 'hover:bg-[var(--bg-muted)]')}
    >
      {hit.image ? (
        <img src={optimizedImageUrl(hit.image, 96)} alt="" className="size-8 shrink-0 rounded-lg bg-white object-contain" loading="lazy" />
      ) : (
        <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', active ? 'bg-[var(--brand)] text-[var(--brand-fg)]' : 'bg-[var(--bg-muted)] text-[var(--fg-muted)]')}>
          <SiteIcon name={hit.icon} size={15} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-sm', hit.more ? 'font-medium text-[var(--brand-text)]' : 'font-medium')}>
          {hit.more ? hit.title : <Marked text={hit.title} words={words} />}
        </span>
        {hit.detail ? (
          <span className="block truncate text-xs text-[var(--fg-muted)]">
            <Marked text={hit.detail} words={words} />
          </span>
        ) : null}
      </span>
      {active ? <SiteIcon name="arrow-right" size={14} className="shrink-0 text-[var(--brand-text)]" /> : null}
    </button>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="px-3 py-6 text-center text-sm text-[var(--fg-muted)]">{children}</p>
}
