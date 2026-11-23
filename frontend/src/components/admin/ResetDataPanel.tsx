import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api, { getErrorMessage } from '@/api/client'
import { Panel } from '@/components/admin/Panel'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { cn } from '@/lib/cn'
import { toast } from '@/store/toastStore'
import type { ApiResponse } from '@/types'

type Group = 'catalog' | 'inventory' | 'orders' | 'customers' | 'money' | 'marketing' | 'messages' | 'history'
type Preview = { word: string; groups: Record<Group, Record<string, number>> }

/** The repository's backup page (GitHub → Actions → Database backup) */
export const BACKUP_URL = 'https://github.com/reda57493110/brynoxa-website/actions/workflows/backup.yml'

const GROUPS: { id: Group; title: string; what: string; needs?: Group }[] = [
  { id: 'catalog', title: 'Products', what: 'All products, their photos, wishlists, old reviews; home page and shop picks go back to suggestions' },
  { id: 'inventory', title: 'Stock', what: 'Stock movements, units, supplier receipts, returns, repairs', needs: 'catalog' },
  { id: 'orders', title: 'Orders', what: 'All orders, deposits, customer notifications, sent emails; coupons stay (their use goes back to 0)' },
  { id: 'customers', title: 'Customers', what: 'Customer and guest accounts (never staff), blocked numbers, push subscriptions', needs: undefined },
  { id: 'money', title: 'Expenses & ads', what: 'Expenses (Profit) and ad campaigns with their spending' },
  { id: 'marketing', title: 'Marketing', what: 'Push campaigns, social media figures, newsletter subscribers' },
  { id: 'messages', title: 'Messages', what: 'Contact form messages (Inbox)' },
  { id: 'history', title: 'Team history', what: 'Everything staff did so far (a line saying you emptied the data is kept)' },
]

/** One of each ("1 return", not "1 returns") */
const ONE: Record<string, string> = {
  products: 'product',
  wishlists: 'wishlist',
  reviews: 'review',
  movements: 'stock movement',
  units: 'unit',
  receipts: 'receipt',
  returns: 'return',
  repairs: 'repair',
  orders: 'order',
  deposits: 'deposit',
  notifications: 'notification',
  emails: 'email',
  customers: 'account',
  blocked: 'blocked number',
  pushSubscriptions: 'push subscription',
  expenses: 'expense',
  campaigns: 'ad campaign',
  pushCampaigns: 'push campaign',
  social: 'social figure',
  newsletter: 'subscriber',
  messages: 'message',
  history: 'history line',
}

const LABEL: Record<string, string> = {
  products: 'products',
  wishlists: 'wishlists',
  reviews: 'reviews',
  movements: 'stock movements',
  units: 'units',
  receipts: 'receipts',
  returns: 'returns',
  repairs: 'repairs',
  orders: 'orders',
  deposits: 'deposits',
  notifications: 'notifications',
  emails: 'emails',
  customers: 'accounts',
  blocked: 'blocked numbers',
  pushSubscriptions: 'push subscriptions',
  expenses: 'expenses',
  campaigns: 'ad campaigns',
  pushCampaigns: 'push campaigns',
  social: 'social figures',
  newsletter: 'subscribers',
  messages: 'messages',
  history: 'history lines',
}

/** Groups that go with another one: stock with products, orders with customers */
const forced = (chosen: Set<Group>) => {
  const out = new Set(chosen)
  if (out.has('catalog')) out.add('inventory')
  if (out.has('customers')) out.add('orders')
  return out
}

/**
 * Admin → Security → "Empty the test data" (owner only): before the shop opens, removes test
 * products, orders, customers… group by group, with the numbers shown first. Settings, design,
 * staff, categories, brands and coupons stay. Needs a backup tick, the owner's password and the
 * word EMPTY. Server: services/resetData.service.ts.
 */
export function ResetDataPanel() {
  const qc = useQueryClient()
  const [chosen, setChosen] = useState<Set<Group>>(new Set(['catalog', 'orders', 'customers', 'money', 'marketing', 'messages']))
  const [backedUp, setBackedUp] = useState(false)
  const [password, setPassword] = useState('')
  const [word, setWord] = useState('')
  const preview = useQuery({
    queryKey: ['admin-reset-preview'],
    queryFn: async () => (await api.get<ApiResponse<Preview>>('/admin/reset-data')).data.data,
  })
  const groups = forced(chosen)
  const total = (g: Group) => Object.values(preview.data?.groups[g] ?? {}).reduce((a, n) => a + n, 0)
  const ready = backedUp && password.length > 0 && word.trim() === (preview.data?.word ?? 'EMPTY') && groups.size > 0

  const run = useMutation({
    mutationFn: async () =>
      (await api.post<ApiResponse<{ groups: Group[]; removed: Record<string, number> }>>('/admin/reset-data', { groups: [...groups], password, confirm: word.trim() })).data.data,
    onSuccess: (r) => {
      const n = Object.values(r.removed).reduce((a, x) => a + x, 0)
      toast.success(`Done: ${n} items removed`)
      setPassword('')
      setWord('')
      setBackedUp(false)
      qc.invalidateQueries()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <Panel
      title="Empty the test data"
      description="Before the shop opens: remove the test products, orders and customers. Settings, design, staff accounts, categories, brands and coupons stay."
    >
      {preview.isLoading ? (
        <div className="flex justify-center py-4">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-4">
          <ul className="grid gap-2 sm:grid-cols-2">
            {GROUPS.map((g) => {
              const on = groups.has(g.id)
              const locked = !chosen.has(g.id) && on // added because another group needs it
              const counts = preview.data?.groups[g.id] ?? {}
              return (
                <li key={g.id}>
                  <label
                    className={cn(
                      'flex h-full cursor-pointer gap-2.5 rounded-xl border p-3 transition',
                      on ? 'border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_6%,transparent)]' : 'border-[var(--border)]',
                      locked && 'cursor-default'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={locked}
                      onChange={() =>
                        setChosen((cur) => {
                          const next = new Set(cur)
                          if (next.has(g.id)) next.delete(g.id)
                          else next.add(g.id)
                          return next
                        })
                      }
                      className="mt-0.5 size-4 shrink-0 accent-[var(--danger)]"
                    />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-sm font-semibold">{g.title}</span>
                        <span className="text-xs tabular-nums text-[var(--fg-muted)]">{total(g.id) === 1 ? '1 item' : `${total(g.id)} items`}</span>
                      </span>
                      <span className="mt-0.5 block text-xs text-[var(--fg-muted)]">{g.what}</span>
                      <span className="mt-1 block text-[11px] text-[var(--fg-muted)]">
                        {Object.entries(counts)
                          .filter(([, n]) => n > 0)
                          .map(([k, n]) => `${n} ${n === 1 ? ONE[k] ?? k : LABEL[k] ?? k}`)
                          .join(' · ') || 'Nothing in it'}
                      </span>
                      {locked ? <span className="mt-1 block text-[11px] font-medium text-[var(--danger)]">Goes with {g.id === 'inventory' ? 'Products' : 'Customers'}</span> : null}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>

          {/* 1 · Backup first */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/40 p-3">
            <p className="text-sm font-semibold">1 · Make a backup first</p>
            <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
              GitHub → Actions → Database backup → <strong>Run workflow</strong>, and wait for the green ✅. If something goes wrong, that backup puts everything back.
            </p>
            <a href={BACKUP_URL} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand-text)] hover:underline">
              Open the backup page <SiteIcon name="external" size={11} />
            </a>
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={backedUp} onChange={(e) => setBackedUp(e.target.checked)} className="size-4 accent-[var(--brand)]" />
              I made a backup and it is green
            </label>
          </div>

          {/* 2 · Password and the word */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="2 · Your password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Input
              label={`3 · Type ${preview.data?.word ?? 'EMPTY'} to confirm`}
              value={word}
              onChange={(e) => setWord(e.target.value)}
              autoComplete="off"
              placeholder={preview.data?.word ?? 'EMPTY'}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="danger" disabled={!ready} loading={run.isPending} onClick={() => run.mutate()}>
              <SiteIcon name="trash" size={15} />
              Empty {groups.size} group{groups.size === 1 ? '' : 's'}
            </Button>
            <span className="text-xs text-[var(--fg-muted)]">This cannot be undone here — only by restoring the backup.</span>
          </div>
        </div>
      )}
    </Panel>
  )
}
