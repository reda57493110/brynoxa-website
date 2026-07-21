import { Link } from 'react-router-dom'
import { ExternalLink, Menu, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useThemeStore } from '@/store/themeStore'
import { useAuthStore } from '@/store/authStore'

export function AdminTopbar({ onMenu }: { onMenu: () => void }) {
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const user = useAuthStore((s) => s.user)

  return (
    <header className="flex h-16 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-elevated)] px-4">
      <Button variant="ghost" size="sm" className="lg:hidden" onClick={onMenu} aria-label="Menu">
        <Menu className="h-5 w-5" />
      </Button>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)]"
        >
          Storefront <ExternalLink className="h-3.5 w-3.5" />
        </Link>
        <span className="hidden text-sm text-[var(--fg-muted)] sm:inline">{user?.name}</span>
      </div>
    </header>
  )
}
