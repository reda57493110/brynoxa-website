import { NavLink } from 'react-router-dom'
import {
  Boxes,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingBag,
  Tag,
  Ticket,
  Users,
  Warehouse,
  Star,
  Layers,
} from 'lucide-react'
import { cn } from '@/lib/cn'

const items = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/categories', label: 'Categories', icon: Layers },
  { to: '/admin/brands', label: 'Brands', icon: Boxes },
  { to: '/admin/inventory', label: 'Inventory', icon: Warehouse },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { to: '/admin/reviews', label: 'Reviews', icon: Star },
  { to: '/admin/coupons', label: 'Coupons', icon: Ticket },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
]

export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <aside className="flex h-full w-64 flex-col border-r border-[var(--border)] bg-[var(--bg-elevated)]">
      <div className="flex h-16 items-center gap-2 border-b border-[var(--border)] px-5">
        <Tag className="h-5 w-5 text-[var(--brand)]" />
        <span className="font-display text-lg font-bold">
          Brynox<span className="text-[var(--brand)]">a</span>
          <span className="ml-1 text-xs font-medium text-[var(--fg-muted)]">Admin</span>
        </span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                isActive
                  ? 'bg-[color-mix(in_srgb,var(--brand)_15%,transparent)] text-[var(--brand)]'
                  : 'text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)]'
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
