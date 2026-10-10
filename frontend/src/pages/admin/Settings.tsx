import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { Spinner } from '@/components/ui/Spinner'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { SiteIcon, type SiteIconName } from '@/components/ui/SiteIcon'
import { PageHeaderProducts } from '@/components/admin/PageHeaderProducts'
import { EmailNotificationsSettings } from '@/components/admin/EmailNotificationsSettings'
import { WholesaleTiersSettings } from '@/components/admin/WholesaleTiersSettings'
import { CustomerSegmentSettings } from '@/components/admin/CustomerSegmentSettings'
import { InventorySettings } from '@/components/admin/InventorySettings'
import { CategoriesSettings } from '@/components/admin/settings/CategoriesSettings'
import { GeneralSettings, OrdersSettings } from '@/components/admin/settings/StoreSettings'
import { SettingsCard } from '@/components/admin/settings/SettingsUi'
import { DirtyContext } from '@/components/admin/settings/dirty'
import { cn } from '@/lib/cn'
import type { StoreSettings } from '@/types'

type SectionId = 'general' | 'orders' | 'storefront' | 'catalog' | 'inventory' | 'customers' | 'notifications' | 'security'

const SECTIONS: { id: SectionId; label: string; icon: SiteIconName; description: string }[] = [
  { id: 'general', label: 'General', icon: 'settings', description: 'Store identity' },
  { id: 'orders', label: 'Orders & payments', icon: 'banknote', description: 'Cash on delivery and deposits' },
  { id: 'storefront', label: 'Storefront', icon: 'monitor', description: 'What customers see first' },
  { id: 'catalog', label: 'Catalog', icon: 'layers', description: 'Categories and spec types' },
  { id: 'inventory', label: 'Inventory', icon: 'warehouse', description: 'Receiving and storage' },
  { id: 'customers', label: 'Customers & pricing', icon: 'users', description: 'Wholesale tiers and segments' },
  { id: 'notifications', label: 'Notifications', icon: 'mail', description: 'Automatic emails' },
  { id: 'security', label: 'Security', icon: 'shield', description: 'Your account protection' },
]

function SectionBody({ id, settings }: { id: SectionId; settings?: StoreSettings }): ReactNode {
  switch (id) {
    case 'general':
      return <GeneralSettings settings={settings} />
    case 'orders':
      return <OrdersSettings settings={settings} />
    case 'storefront':
      return (
        <SettingsCard
          title="Shop page header"
          description="The product at the top of the Shop page. Automatic uses your first featured product. Saved immediately."
        >
          <PageHeaderProducts value={settings?.pageHeroProducts} />
        </SettingsCard>
      )
    case 'catalog':
      return <CategoriesSettings />
    case 'inventory':
      return <InventorySettings settings={settings} />
    case 'customers':
      return (
        <>
          <WholesaleTiersSettings settings={settings} />
          <CustomerSegmentSettings settings={settings} />
        </>
      )
    case 'notifications':
      return <EmailNotificationsSettings settings={settings} />
    case 'security':
      return (
        <SettingsCard title="Account security" description="Password, two-step sign-in and sessions.">
          <Link
            to="/admin/security"
            className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--border)] px-4 text-sm font-medium hover:border-[var(--brand)] hover:text-[var(--brand-text)]"
          >
            <SiteIcon name="shield" size={14} /> Open security settings
          </Link>
          <p className="text-xs text-[var(--fg-muted)]">Staff roles and permissions are managed in Roles.</p>
        </SettingsCard>
      )
  }
}

export function Settings() {
  const [params, setParams] = useSearchParams()
  const requested = params.get('tab') as SectionId | null
  const active: SectionId = SECTIONS.some((s) => s.id === requested) ? requested! : 'general'
  const current = SECTIONS.find((s) => s.id === active)!

  const settings = useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => (await adminApi.settings.get()).data.data,
  })

  // Unsaved changes reported by the sections
  const dirtyRef = useRef(new Set<string>())
  const [dirtyCount, setDirtyCount] = useState(0)
  const report = useCallback((key: string, dirty: boolean) => {
    const set = dirtyRef.current
    const had = set.has(key)
    if (dirty === had) return
    if (dirty) set.add(key)
    else set.delete(key)
    setDirtyCount(set.size)
  }, [])
  const [pendingTab, setPendingTab] = useState<SectionId | null>(null)

  useEffect(() => {
    if (!dirtyCount) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirtyCount])

  const go = (id: SectionId) => setParams(id === 'general' ? {} : { tab: id }, { replace: true })
  const select = (id: SectionId) => {
    if (id === active) return
    if (dirtyCount > 0) setPendingTab(id)
    else go(id)
  }

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold sm:text-2xl">Settings</h1>
        <p className="text-sm text-[var(--fg-muted)]">Store configuration, grouped by topic.</p>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-6">
        {/* Section navigation: a scrollable row on mobile, a sidebar on desktop */}
        <nav aria-label="Settings sections" className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          <ul className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0">
            {SECTIONS.map((s) => (
              <li key={s.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => select(s.id)}
                  aria-current={s.id === active ? 'page' : undefined}
                  className={cn(
                    'flex w-full items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm transition',
                    s.id === active
                      ? 'bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] font-medium text-[var(--brand-text)]'
                      : 'text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)] max-lg:border max-lg:border-[var(--border)]'
                  )}
                >
                  <SiteIcon name={s.icon} size={16} className="shrink-0" />
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] text-[var(--brand-text)]">
              <SiteIcon name={current.icon} size={18} />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-base font-semibold sm:text-lg">{current.label}</h2>
              <p className="text-xs text-[var(--fg-muted)]">{current.description}</p>
            </div>
          </div>

          {settings.isLoading ? (
            <div className="flex justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : settings.isError ? (
            <QueryErrorState onRetry={() => settings.refetch()} />
          ) : (
            <DirtyContext.Provider value={report}>
              <SectionBody key={active} id={active} settings={settings.data} />
            </DirtyContext.Provider>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(pendingTab)}
        title="Discard unsaved changes?"
        description="Changes in this section are not saved yet."
        confirmLabel="Discard"
        onClose={() => setPendingTab(null)}
        onConfirm={() => {
          if (pendingTab) go(pendingTab)
          setPendingTab(null)
        }}
      />
    </div>
  )
}
