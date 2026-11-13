import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { canOpenAdminPath } from '@/lib/permissions'
import { useAuthStore } from '@/store/authStore'

const TABS = [
  { to: '/admin/inventory', label: 'Overview', end: true },
  { to: '/admin/inventory/receive', label: 'Receive delivery' },
  { to: '/admin/inventory/returns', label: 'Returns' },
  { to: '/admin/inventory/repairs', label: 'Repairs' },
  { to: '/admin/inventory/movements', label: 'Stock log' },
  // Inspection, storage places, statuses (owner / staff allowed to change settings)
  { to: '/admin/inventory/settings', label: 'Settings' },
]

/** Tabs shared by all inventory pages. */
export function InventoryNav() {
  const role = useAuthStore((st) => st.user?.role)
  const tabs = TABS.filter((tab) => canOpenAdminPath(role, tab.to))
  return (
    <nav
      aria-label="Inventory sections"
      className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            cn(
              'inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium transition',
              isActive
                ? 'border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--brand-text)]'
                : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--brand)] hover:text-[var(--fg)]'
            )
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
