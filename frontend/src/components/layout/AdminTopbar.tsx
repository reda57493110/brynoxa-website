import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { useThemeStore } from '@/store/themeStore'
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/api/authApi'
import { useAdminStats } from '@/hooks/useAdminStats'
import {
  STAFF_ROLE_LABELS,
  hasPermission,
  isStaffRole,
  type StaffRole,
} from '@/lib/permissions'

export function AdminTopbar({ onMenu }: { onMenu: () => void }) {
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const stats = useAdminStats()
  const role = user?.role
  const roleLabel = isStaffRole(role) ? STAFF_ROLE_LABELS[role as StaffRole] : 'Staff'
  const canOrders = hasPermission(role, 'orders:read')

  const signOut = async () => {
    try {
      await authApi.logout()
    } catch {
      /* cookie may already be gone */
    }
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-elevated)]/95 px-3 backdrop-blur-md sm:h-16 sm:gap-3 sm:px-4">
      <Button
        variant="ghost"
        size="sm"
        className="shrink-0 lg:hidden"
        onClick={onMenu}
        aria-label="Open menu"
      >
        <SiteIcon name="menu" size={18} />
      </Button>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2 lg:hidden">
          <p className="truncate text-sm font-medium text-[var(--fg)]">{roleLabel}</p>
        </div>
        <p className="hidden text-sm text-[var(--fg-muted)] md:block">
          {canOrders
            ? `Live · ${stats.data?.todayOrders ?? 0} orders today`
            : `${roleLabel} workspace`}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <Badge variant="brand" className="hidden sm:inline-flex">
          {roleLabel}
        </Badge>
        {canOrders && stats.data && stats.data.pendingOrders > 0 ? (
          <Link
            to="/admin/orders?status=pending"
            className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--warning)_16%,transparent)] px-2.5 py-1.5 text-xs font-semibold text-[var(--warning)]"
          >
            <span className="sm:hidden">{stats.data.pendingOrders}</span>
            <span className="hidden sm:inline">{stats.data.pendingOrders} pending</span>
          </Link>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <SiteIcon name="sun" size={16} /> : <SiteIcon name="moon" size={16} />}
        </Button>
        <Link
          to="/"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)] sm:w-auto sm:gap-1.5 sm:px-3 sm:py-2 sm:text-sm"
          aria-label="View store"
          title="View store"
        >
          <span className="hidden sm:inline">Store</span>
          <SiteIcon name="external" size={14} />
        </Link>
        <span className="hidden max-w-[9rem] truncate text-sm text-[var(--fg-muted)] md:inline">
          {user?.name}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          aria-label="Sign out"
          className="px-2 sm:px-3"
        >
          <span className="hidden sm:inline">Sign out</span>
          <SiteIcon name="logout" size={16} className="sm:hidden" />
        </Button>
      </div>
    </header>
  )
}
