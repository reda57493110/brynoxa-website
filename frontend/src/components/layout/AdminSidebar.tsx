import { Link, NavLink } from 'react-router-dom'
import { SiteIcon, type SiteIconName } from '@/components/ui/SiteIcon'
import { cn } from '@/lib/cn'
import { useAdminStats } from '@/hooks/useAdminStats'

const items: { to: string; label: string; icon: SiteIconName; end?: boolean; badge?: 'pending' | 'stock' | 'inbox' }[] = [
  { to: '/admin', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/admin/orders', label: 'Orders', icon: 'cart', badge: 'pending' },
  { to: '/admin/products', label: 'Products', icon: 'package' },
  { to: '/admin/inventory', label: 'Inventory', icon: 'warehouse', badge: 'stock' },
  { to: '/admin/customers', label: 'Customers', icon: 'users' },
  { to: '/admin/messages', label: 'Inbox', icon: 'inbox', badge: 'inbox' },
  { to: '/admin/reviews', label: 'Reviews', icon: 'star' },
  { to: '/admin/coupons', label: 'Coupons', icon: 'ticket' },
  { to: '/admin/settings', label: 'Settings', icon: 'settings' },
]

export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const stats = useAdminStats()
  const s = stats.data

  const badgeValue = (key?: (typeof items)[number]['badge']) => {
    if (!s || !key) return 0
    if (key === 'pending') return s.pendingOrders
    if (key === 'stock') return s.lowStock
    return s.unreadMessages
  }

  return (
    <aside className="flex h-full w-64 flex-col border-r border-[var(--border)] bg-[var(--bg-elevated)]">
      <Link to="/admin" className="flex h-16 items-center gap-2 border-b border-[var(--border)] px-5">
        <SiteIcon name="tag" size={18} className="text-[var(--brand)]" />
        <span className="font-display text-lg font-bold">
          Brynox<span className="text-[var(--brand)]">a</span>
          <span className="ml-1 text-xs font-medium text-[var(--fg-muted)]">Admin</span>
        </span>
      </Link>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map(({ to, label, icon, end, badge }) => {
          const count = badgeValue(badge)
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                  isActive
                    ? 'bg-[color-mix(in_srgb,var(--brand)_15%,transparent)] text-[var(--brand-text)]'
                    : 'text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)]'
                )
              }
            >
              <SiteIcon name={icon} size={16} />
              <span className="flex-1">{label}</span>
              {count > 0 ? (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--brand)] px-1 text-[10px] font-bold text-[var(--brand-fg)]">
                  {count > 99 ? '99+' : count}
                </span>
              ) : null}
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}
