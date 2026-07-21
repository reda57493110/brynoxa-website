import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AdminSidebar } from '@/components/layout/AdminSidebar'
import { AdminTopbar } from '@/components/layout/AdminTopbar'
import { Drawer } from '@/components/ui/Drawer'

export function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <div className="hidden lg:block">
        <AdminSidebar />
      </div>
      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} title="Admin" side="left">
        <div className="-m-4">
          <AdminSidebar onNavigate={() => setMenuOpen(false)} />
        </div>
      </Drawer>
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar onMenu={() => setMenuOpen(true)} />
        <main className="flex-1 overflow-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
