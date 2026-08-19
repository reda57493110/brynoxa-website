import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { useThemeStore } from '@/store/themeStore'
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/api/authApi'
import { useAdminStats } from '@/hooks/useAdminStats'

export function AdminTopbar({ onMenu }: { onMenu: () => void }) {
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const stats = useAdminStats()

  const signOut = async () => {
    try {
      await authApi.logout()
    } catch {
      /* cookie may already be gone */
    }
    logout()
    navigate('/login')
  }

  return (
    <header className="flex h-16 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-elevated)] px-4">
      <Button variant="ghost" size="sm" className="lg:hidden" onClick={onMenu} aria-label="Menu">
        <SiteIcon name="menu" size={18} />
      </Button>
      <div className="hidden text-sm text-[var(--fg-muted)] md:block">
        Live · {stats.data?.todayOrders ?? 0} orders today
      </div>
      <div className="ml-auto flex items-center gap-2">
        {stats.data && stats.data.pendingOrders > 0 ? (
          <Link
            to="/admin/orders?status=pending"
            className="hidden items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--warning)_16%,transparent)] px-3 py-1.5 text-xs font-semibold text-[var(--warning)] sm:inline-flex"
          >
            {stats.data.pendingOrders} pending
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
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)]"
        >
          Store <SiteIcon name="external" size={14} />
        </Link>
        <span className="hidden max-w-[10rem] truncate text-sm text-[var(--fg-muted)] sm:inline">
          {user?.name}
        </span>
        <Button variant="ghost" size="sm" onClick={signOut}>
          Sign out
        </Button>
      </div>
    </header>
  )
}
