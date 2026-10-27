import { Fragment } from 'react'
import { NavLink } from 'react-router-dom'
import { BrandLogo } from '@/components/brand/BrandLogo'
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
  group: string
}[] = [
  // Ordered by importance for running the shop day to day
  { to: '/admin', label: 'Dashboard', icon: 'dashboard', end: true, group: 'Daily work' },
  { to: '/admin/orders', label: 'Orders', icon: 'cart', badge: 'pending', group: 'Daily work' },
  { to: '/admin/messages', label: 'Inbox', icon: 'inbox', badge: 'inbox', group: 'Daily work' },
  { to: '/admin/customers', label: 'Customers', icon: 'users', group: 'Daily work' },
  { to: '/admin/products', label: 'Products', icon: 'package', group: 'Catalog' },
  { to: '/admin/inventory', label: 'Inventory', icon: 'warehouse', badge: 'stock', group: 'Catalog' },
  { to: '/admin/setup', label: 'Complete your setup', icon: 'layers', group: 'Catalog' },
  { to: '/admin/profit', label: 'Profit', icon: 'banknote', group: 'Money' },
  { to: '/admin/analytics', label: 'Analytics', icon: 'sliders', group: 'Money' },
  { to: '/admin/coupons', label: 'Coupons', icon: 'ticket', group: 'Marketing' },
  { to: '/admin/notifications', label: 'Notifications', icon: 'bell', group: 'Marketing' },
  { to: '/admin/emails', label: 'Emails', icon: 'mail', group: 'Marketing' },
  { to: '/admin/settings', label: 'Settings', icon: 'settings', group: 'Store' },
  { to: '/admin/roles', label: 'Roles', icon: 'shield', group: 'Store' },
  { to: '/admin/security', label: 'Security', icon: 'shield', group: 'Store' },
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
    if (key === 'stock') return s.lowStock + (s.outOfStock || 0)
    return s.unreadMessages
  }

  const visible = items.filter((item) => {
    const permission = ADMIN_NAV_PERMISSION[item.to]
    return Boolean(permission && hasPermission(role, permission))
  })

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-[var(--border)] bg-[var(--bg-elevated)]',
        // Desktop: stays in view while the page scrolls
        embedded ? 'h-full w-full border-r-0' : 'h-dvh w-64 overflow-y-auto'
      )}
    >
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--border)] px-4 sm:h-16 sm:px-5">
        <BrandLogo
          to={home}
          onClick={onNavigate}
          suffix="Admin"
          className="min-w-0 flex-1"
          markClassName="h-8 w-8"
        />
        {embedded && onNavigate ? (
          <Button variant="ghost" size="sm" onClick={onNavigate} aria-label="Close menu">
            <SiteIcon name="close" size={16} />
          </Button>
        ) : null}
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2.5 sm:space-y-1 sm:p-3">
        {visible.map(({ to, label, icon, end, badge, group }, i) => {
          const count = badgeValue(badge)
          const heading = i === 0 || visible[i - 1].group !== group
          return (
            <Fragment key={to}>
            {heading ? (
              <p className={cn('px-3 pb-1 text-[10px] font-semibold tracking-wide text-[var(--fg-muted)] uppercase opacity-80', i > 0 && 'pt-3')}>{group}</p>
            ) : null}
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
            </Fragment>
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
