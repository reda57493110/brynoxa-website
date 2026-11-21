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
import { useAdminT } from '@/store/adminLangStore'
import type { AdminKey } from '@/i18n/admin'

const items: {
  to: string
  /** Admin text key (i18n/admin.ts) */
  label: AdminKey
  icon: SiteIconName
  end?: boolean
  badge?: 'pending' | 'stock' | 'inbox'
  group: AdminKey
}[] = [
  // Ordered by importance for running the shop day to day
  { to: '/admin', label: 'nav.dashboard', icon: 'dashboard', end: true, group: 'group.daily' },
  { to: '/admin/orders', label: 'nav.orders', icon: 'cart', badge: 'pending', group: 'group.daily' },
  { to: '/admin/messages', label: 'nav.inbox', icon: 'inbox', badge: 'inbox', group: 'group.daily' },
  { to: '/admin/customers', label: 'nav.customers', icon: 'users', group: 'group.daily' },
  { to: '/admin/products', label: 'nav.products', icon: 'package', group: 'group.catalog' },
  { to: '/admin/inventory', label: 'nav.inventory', icon: 'warehouse', badge: 'stock', group: 'group.catalog' },
  { to: '/admin/profit', label: 'nav.profit', icon: 'banknote', group: 'group.money' },
  { to: '/admin/analytics', label: 'nav.analytics', icon: 'sliders', group: 'group.money' },
  { to: '/admin/social', label: 'nav.social', icon: 'chat', group: 'group.marketing' },
  { to: '/admin/ads', label: 'nav.ads', icon: 'megaphone', group: 'group.marketing' },
  { to: '/admin/coupons', label: 'nav.coupons', icon: 'ticket', group: 'group.marketing' },
  { to: '/admin/notifications', label: 'nav.notifications', icon: 'bell', group: 'group.marketing' },
  { to: '/admin/emails', label: 'nav.emails', icon: 'mail', group: 'group.marketing' },
  { to: '/admin/settings', label: 'nav.settings', icon: 'settings', group: 'group.store' },
  { to: '/admin/history', label: 'nav.history', icon: 'clock', group: 'group.store' },
  { to: '/admin/roles', label: 'nav.roles', icon: 'shield', group: 'group.store' },
  { to: '/admin/security', label: 'nav.security', icon: 'shield', group: 'group.store' },
]

export function AdminSidebar({
  onNavigate,
  embedded,
}: {
  onNavigate?: () => void
  /** Drawer mode: full-height panel with close affordance via parent */
  embedded?: boolean
}) {
  const a = useAdminT()
  const stats = useAdminStats()
  const s = stats.data
  const role = useAuthStore((st) => st.user?.role)
  const home = staffHomePath(role)
  const roleLabel = isStaffRole(role) ? a(`role.${role as StaffRole}` as AdminKey) : a('role.staff')
  void STAFF_ROLE_LABELS

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
        'flex flex-col border-e border-[var(--border)] bg-[var(--bg-elevated)]',
        // Desktop: stays in view while the page scrolls
        embedded ? 'h-full w-full border-e-0' : 'h-dvh w-64 overflow-y-auto'
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
          <Button variant="ghost" size="sm" onClick={onNavigate} aria-label={a('nav.closeMenu')}>
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
              <p className={cn('px-3 pb-1 text-[10px] font-semibold tracking-wide text-[var(--fg-muted)] uppercase opacity-80', i > 0 && 'pt-3')}>{a(group)}</p>
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
              <span className="flex-1">{a(label)}</span>
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
          {a('nav.yourRole')}
        </p>
        <Badge variant="brand" className="mt-1.5">
          {roleLabel}
        </Badge>
      </div>
    </aside>
  )
}
