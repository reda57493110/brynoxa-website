import { Link, NavLink } from 'react-router-dom'
import { SiteIcon, type SiteIconName } from '@/components/ui/SiteIcon'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import {
  ADMIN_NAV_PERMISSION,
  STAFF_ROLE_LABELS,
  hasPermission,
  isStaffRole,
  staffHomePath,
  type StaffRole,
} from '@/lib/permissions'
import { useAdminStats } from '@/hooks/useAdminStats'
import { useAuthStore } from '@/store/authStore'

const items: {
  to: string
  label: string
  icon: SiteIconName
  end?: boolean
  badge?: 'pending' | 'stock' | 'inbox'
}[] = [
  { to: '/admin', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/admin/orders', label: 'Orders', icon: 'cart', badge: 'pending' },
  { to: '/admin/products', label: 'Products', icon: 'package' },
  { to: '/admin/inventory', label: 'Inventory', icon: 'warehouse', badge: 'stock' },
  { to: '/admin/customers', label: 'Customers', icon: 'users' },
  { to: '/admin/roles', label: 'Roles', icon: 'shield' },
  { to: '/admin/messages', label: 'Inbox', icon: 'inbox', badge: 'inbox' },
  { to: '/admin/reviews', label: 'Reviews', icon: 'star' },
  { to: '/admin/coupons', label: 'Coupons', icon: 'ticket' },
  { to: '/admin/security', label: 'Security', icon: 'shield' },
  { to: '/admin/settings', label: 'Settings', icon: 'settings' },
]

export function AdminSidebar({
  onNavigate,
  embedded,
}: {
  onNavigate?: () => void
  /** Drawer mode: full-height panel with close affordance via parent */
  embedded?: boolean
}) {
  const stats = useAdminStats()
  const s = stats.data
  const role = useAuthStore((st) => st.user?.role)
  const home = staffHomePath(role)
  const roleLabel = isStaffRole(role) ? STAFF_ROLE_LABELS[role as StaffRole] : 'Staff'

  const badgeValue = (key?: (typeof items)[number]['badge']) => {
    if (!s || !key) return 0
    if (key === 'pending') return s.pendingOrders
    if (key === 'stock') return s.lowStock
    return s.unreadMessages
  }

  const visible = items.filter((item) => {
    const permission = ADMIN_NAV_PERMISSION[item.to]
    return item.to === '/admin/security' || Boolean(permission && hasPermission(role, permission))
  })

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-[var(--border)] bg-[var(--bg-elevated)]',
        embedded ? 'h-full w-full border-r-0' : 'h-full w-64'
      )}
    >
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--border)] px-4 sm:h-16 sm:px-5">
        <Link
          to={home}
          onClick={onNavigate}
          className="flex min-w-0 flex-1 items-center gap-2"
        >
          <SiteIcon name="tag" size={18} className="shrink-0 text-[var(--brand)]" />
          <span className="font-display text-lg font-bold">
            Brynox<span className="text-[var(--brand)]">a</span>
            <span className="ml-1 text-xs font-medium text-[var(--fg-muted)]">Admin</span>
          </span>
        </Link>
        {embedded && onNavigate ? (
          <Button variant="ghost" size="sm" onClick={onNavigate} aria-label="Close menu">
            <SiteIcon name="close" size={16} />
          </Button>
        ) : null}
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2.5 sm:space-y-1 sm:p-3">
        {visible.map(({ to, label, icon, end, badge }) => {
          const count = badgeValue(badge)
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                  isActive
                    ? 'bg-[color-mix(in_srgb,var(--brand)_15%,transparent)] text-[var(--brand-text)]'
                    : 'text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)]'
                )
              }
            >
              <SiteIcon name={icon} size={16} className="shrink-0" />
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
      <div className="border-t border-[var(--border)] p-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--fg-muted)]">
          Your role
        </p>
        <Badge variant="brand" className="mt-1.5">
          {roleLabel}
        </Badge>
      </div>
    </aside>
  )
}
