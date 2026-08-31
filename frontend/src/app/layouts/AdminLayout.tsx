import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Navigate, Outlet, useLocation, useNavigationType } from 'react-router-dom'
import { AdminSidebar } from '@/components/layout/AdminSidebar'
import { AdminTopbar } from '@/components/layout/AdminTopbar'
import { Drawer } from '@/components/ui/Drawer'
import {
  ADMIN_NAV_PERMISSION,
  hasPermission,
  staffHomePath,
} from '@/lib/permissions'
import { useAuthStore } from '@/store/authStore'

const adminScrollPositions = new Map<string, number>()

function requiredPermissionForPath(pathname: string) {
  const entries = Object.entries(ADMIN_NAV_PERMISSION).sort(
    (a, b) => b[0].length - a[0].length
  )
  for (const [path, permission] of entries) {
    if (path === '/admin') {
      if (pathname === '/admin' || pathname === '/admin/') return permission
      continue
    }
    if (pathname === path || pathname.startsWith(`${path}/`)) return permission
  }
  return null
}

export function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const navigationType = useNavigationType()
  const mainRef = useRef<HTMLElement>(null)
  const role = useAuthStore((s) => s.user?.role)
  const home = staffHomePath(role)
  const required = requiredPermissionForPath(location.pathname)

  useLayoutEffect(() => {
    const main = mainRef.current
    return () => {
      adminScrollPositions.set(location.key, main?.scrollTop ?? 0)
    }
  }, [location.key])

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const main = mainRef.current
        if (!main) return
        main.scrollTo({
          top: navigationType === 'POP' ? adminScrollPositions.get(location.key) ?? 0 : 0,
          behavior: 'auto',
        })
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [location.key, navigationType])

  if (required && !hasPermission(role, required)) {
    return <Navigate to={home} replace />
  }

  return (
    // Admin UI is English — keep LTR even when the storefront language is Arabic
    <div
      className="flex min-h-dvh w-full max-w-[100vw] overflow-x-hidden bg-[var(--bg)] text-[var(--fg)]"
      dir="ltr"
      lang="en"
    >
      <a
        href="#admin-main-content"
        className="fixed left-3 top-3 z-[110] -translate-y-20 rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-[var(--brand-fg)] transition focus:translate-y-0"
      >
        Skip to content
      </a>
      <div className="hidden shrink-0 lg:block">
        <AdminSidebar />
      </div>
      <Drawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        side="left"
        className="max-w-[17.5rem]"
      >
        <div className="-m-4 h-full" dir="ltr" lang="en">
          <AdminSidebar embedded onNavigate={() => setMenuOpen(false)} />
        </div>
      </Drawer>
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar onMenu={() => setMenuOpen(true)} />
        <main
          ref={mainRef}
          id="admin-main-content"
          className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6"
        >
          <div className="mx-auto w-full max-w-6xl min-w-0">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
