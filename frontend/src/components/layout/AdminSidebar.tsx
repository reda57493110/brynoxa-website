import { NavLink } from 'react-router-dom'
import { SiteIcon, type SiteIconName } from '@/components/ui/SiteIcon'
import { cn } from '@/lib/cn'

const items: { to: string; label: string; icon: SiteIconName; end?: boolean }[] = [
  { to: '/admin', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/admin/products', label: 'Products', icon: 'package' },
  { to: '/admin/categories', label: 'Categories', icon: 'layers' },
  { to: '/admin/brands', label: 'Brands', icon: 'boxes' },
  { to: '/admin/inventory', label: 'Inventory', icon: 'warehouse' },
  { to: '/admin/orders', label: 'Orders', icon: 'cart' },
  { to: '/admin/customers', label: 'Customers', icon: 'users' },
  { to: '/admin/reviews', label: 'Reviews', icon: 'star' },
  { to: '/admin/coupons', label: 'Coupons', icon: 'ticket' },
  { to: '/admin/settings', label: 'Settings', icon: 'settings' },
]

export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <aside className="flex h-full w-64 flex-col border-r border-[var(--border)] bg-[var(--bg-elevated)]">
      <div className="flex h-16 items-center gap-2 border-b border-[var(--border)] px-5">
        <SiteIcon name="tag" size={18} className="text-[var(--brand)]" />
        <span className="font-display text-lg font-bold">
          Brynox<span className="text-[var(--brand)]">a</span>
          <span className="ml-1 text-xs font-medium text-[var(--fg-muted)]">Admin</span>
        </span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map(({ to, label, icon, end }) => (
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
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
