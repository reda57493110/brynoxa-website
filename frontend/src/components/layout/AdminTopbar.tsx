import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { useThemeStore } from '@/store/themeStore'
import { useAuthStore } from '@/store/authStore'

export function AdminTopbar({ onMenu }: { onMenu: () => void }) {
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const user = useAuthStore((s) => s.user)

  return (
    <header className="flex h-16 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-elevated)] px-4">
      <Button variant="ghost" size="sm" className="lg:hidden" onClick={onMenu} aria-label="Menu">
        <SiteIcon name="menu" size={18} />
      </Button>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
          {theme === 'dark' ? <SiteIcon name="sun" size={16} /> : <SiteIcon name="moon" size={16} />}
        </Button>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)]"
        >
          Storefront <SiteIcon name="external" size={14} />
        </Link>
        <span className="hidden text-sm text-[var(--fg-muted)] sm:inline">{user?.name}</span>
      </div>
    </header>
  )
}
