import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage, restoreSession } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Pagination } from '@/components/ui/Pagination'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Panel } from '@/components/admin/Panel'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/cn'
import { STAFF_ROLE_LABELS, hasPermission, type Permission, type StaffRole } from '@/lib/permissions'
import { toast } from '@/store/toastStore'
import { useAuthStore } from '@/store/authStore'
import type { User } from '@/types'

/** Hireable roles only — Owner is fixed and never assignable from this page. */
type AssignableRole = Exclude<StaffRole, 'admin'>
const ASSIGNABLE_ROLES: AssignableRole[] = ['orders', 'catalog', 'support', 'marketing']

// Same minimum as the server for staff accounts
const STAFF_PASSWORD_MIN = 12

const ROLE_OPTIONS = ASSIGNABLE_ROLES.map((value) => ({
  value,
  label: STAFF_ROLE_LABELS[value],
}))

/**
 * Admin areas and the permissions behind them. What a role can do is read from ROLE_PERMISSIONS
 * (lib/permissions.ts, mirrored on the server), so this list never drifts from the real rules.
 */
const AREAS: { label: string; view: Permission; edit?: Permission; extra?: { perm: Permission; text: string } }[] = [
  { label: 'Orders', view: 'orders:read', edit: 'orders:write' },
  { label: 'Customers', view: 'customers:read', edit: 'customers:write' },
  { label: 'Products', view: 'products:read', edit: 'products:write', extra: { perm: 'products:delete', text: 'delete' } },
  { label: 'Inventory', view: 'inventory:write', edit: 'inventory:write', extra: { perm: 'inventory:approve', text: 'approvals' } },
  { label: 'Inbox & emails', view: 'messages', edit: 'messages' },
  { label: 'Coupons', view: 'coupons', edit: 'coupons' },
  { label: 'Reviews', view: 'reviews', edit: 'reviews' },
  { label: 'Push notifications', view: 'push', edit: 'push' },
]

function roleAccess(role: AssignableRole) {
  return AREAS.filter((a) => hasPermission(role, a.view)).map((a) => ({
    label: a.label,
    viewOnly: !a.edit || !hasPermission(role, a.edit),
    extra: a.extra && hasPermission(role, a.extra.perm) ? a.extra.text : undefined,
  }))
}

function AccessChips({ role, className }: { role: AssignableRole; className?: string }) {
  return (
    <span className={cn('flex flex-wrap gap-1', className)}>
      {roleAccess(role).map((a) => (
        <span
          key={a.label}
          className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-1.5 py-0.5 text-[11px] leading-none"
        >
          {a.label}
          {a.viewOnly ? <span className="text-[var(--fg-muted)]">· view</span> : null}
          {a.extra ? <span className="text-[var(--fg-muted)]">· {a.extra}</span> : null}
        </span>
      ))}
    </span>
  )
}

function initials(name?: string, email?: string) {
  const source = (name || email || '?').trim()
  const parts = source.split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || source[0].toUpperCase()
}

export function Roles() {
  const qc = useQueryClient()
  const me = useAuthStore((s) => s.user)
  const [page, setPage] = useState(1)
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'orders' as AssignableRole,
  })
  const [showPassword, setShowPassword] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<User | null>(null)
  const [roleChange, setRoleChange] = useState<{ user: User; role: AssignableRole } | null>(null)
  const [roleFilter, setRoleFilter] = useState<AssignableRole | ''>('')
  const [search, setSearch] = useState('')

  const staff = useQuery({
    queryKey: ['admin-users', { page, role: 'staff' }],
    queryFn: async () => {
      const res = await adminApi.users.list({
        limit: 50,
        page,
        role: 'staff',
      })
      return { items: res.data.data, meta: res.data.meta }
    },
  })

  const createUser = useMutation({
    mutationFn: async () => {
      const token = useAuthStore.getState().accessToken ?? (await restoreSession(true))
      if (!token) {
        throw new Error('Session expired — please sign in again')
      }
      return adminApi.users.create({
        name: form.name.trim() || undefined,
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      })
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      qc.invalidateQueries({ queryKey: ['admin-customers'] })
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] })
      const role = res.data.data.role as StaffRole
      toast.success(`${STAFF_ROLE_LABELS[role] ?? 'Staff'} account created`)
      setForm({ name: '', email: '', password: '', role: 'orders' })
      setShowPassword(false)
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: AssignableRole }) => adminApi.users.setRole(id, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('Role updated')
      setRoleChange(null)
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const removeRole = useMutation({
    mutationFn: (id: string) => adminApi.users.setRole(id, 'customer'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      qc.invalidateQueries({ queryKey: ['admin-customers'] })
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] })
      toast.success('Staff access removed')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const allStaff = useMemo(() => (staff.data?.items ?? []).filter((u) => u.role !== 'admin'), [staff.data])
  const owners = (staff.data?.items ?? []).filter((u) => u.role === 'admin').length
  const countFor = (role: AssignableRole) => allStaff.filter((u) => u.role === role).length
  const items = allStaff.filter((u) => {
    if (roleFilter && u.role !== roleFilter) return false
    const q = search.trim().toLowerCase()
    return !q || `${u.name} ${u.email}`.toLowerCase().includes(q)
  })

  const onCreate = (e: FormEvent) => {
    e.preventDefault()
    if (!form.email.trim() || !form.email.includes('@')) {
      toast.error('Enter a valid email')
      return
    }
    if (form.password.length < STAFF_PASSWORD_MIN) {
      toast.error(`Password must be at least ${STAFF_PASSWORD_MIN} characters`)
      return
    }
    createUser.mutate()
  }

  const removeStaff = (user: User) => {
    if (user.role === 'admin') {
      toast.error('Owner account cannot be removed')
      return
    }
    if (String(me?._id) === String(user._id)) {
      toast.error('You cannot remove your own staff access')
      return
    }
    setRemoveTarget(user)
  }

  const askRoleChange = (user: User, role: AssignableRole) => {
    if (role !== user.role) setRoleChange({ user, role })
  }

  const roleLabel = (role: string) => STAFF_ROLE_LABELS[role as StaffRole] ?? role

  const RoleSelect = ({ u, isMe }: { u: User; isMe: boolean }) => (
    <Select
      aria-label={`Role of ${u.name || u.email}`}
      className="h-9 rounded-lg px-2.5 text-sm"
      value={u.role}
      disabled={isMe || changeRole.isPending}
      onChange={(e) => askRoleChange(u, e.target.value as AssignableRole)}
      options={ROLE_OPTIONS}
    />
  )

  const Person = ({ u, isMe }: { u: User; isMe: boolean }) => (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--bg-muted)] text-[11px] font-semibold">
        {initials(u.name, u.email)}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {u.name || '—'}
          {isMe ? <span className="ms-1 text-xs font-normal text-[var(--fg-muted)]">(you)</span> : null}
        </p>
        <p className="truncate text-xs text-[var(--fg-muted)]">{u.email}</p>
      </div>
    </div>
  )

  return (
    <div className="min-w-0 space-y-4">
      <h1 className="font-display text-lg font-semibold tracking-tight sm:text-xl">Roles</h1>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <Panel title="Roles and access" description="Click a role to filter the staff list.">
          <ul className="-my-1 divide-y divide-[var(--border)]">
            <li className="flex items-center justify-between gap-3 py-2">
              <span className="flex items-center gap-2 text-sm font-medium">
                <SiteIcon name="shield" size={14} className="text-[var(--brand)]" />
                Owner
              </span>
              <span className="text-end text-xs text-[var(--fg-muted)]">
                Everything, incl. settings, roles and reports{owners ? ` · ${owners}` : ''}
              </span>
            </li>
            {ASSIGNABLE_ROLES.map((r) => {
              const active = roleFilter === r
              return (
                <li key={r}>
                  <button
                    type="button"
                    onClick={() => setRoleFilter(active ? '' : r)}
                    aria-pressed={active}
                    className={cn(
                      '-mx-2 flex w-[calc(100%+1rem)] min-w-0 flex-col gap-1.5 rounded-lg px-2 py-2 text-start sm:flex-row sm:items-center sm:justify-between',
                      active ? 'bg-[color-mix(in_srgb,var(--brand)_10%,transparent)]' : 'hover:bg-[var(--bg-muted)]'
                    )}
                  >
                    <span className="flex shrink-0 items-center gap-2 text-sm font-medium">
                      {STAFF_ROLE_LABELS[r]}
                      <span className="rounded-full bg-[var(--bg-muted)] px-1.5 text-[11px] font-normal tabular-nums text-[var(--fg-muted)]">
                        {countFor(r)}
                      </span>
                    </span>
                    <AccessChips role={r} className="sm:justify-end" />
                  </button>
                </li>
              )
            })}
          </ul>
        </Panel>

        <Panel title="New staff account" description="They sign in at /login and only see their role's pages.">
          <form onSubmit={onCreate} className="grid min-w-0 gap-3 sm:grid-cols-2">
            <Input
              label="Name (optional)"
              placeholder="Full name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              autoComplete="off"
            />
            <Select
              label="Role"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as AssignableRole }))}
              options={ROLE_OPTIONS}
            />
            <Input
              label="Email"
              type="email"
              name="staff-email"
              placeholder="name@example.com"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
              autoComplete="off"
            />
            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                name="staff-password"
                placeholder={`At least ${STAFF_PASSWORD_MIN} characters`}
                minLength={STAFF_PASSWORD_MIN}
                error={form.password && form.password.length < STAFF_PASSWORD_MIN ? `At least ${STAFF_PASSWORD_MIN} characters` : undefined}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                required
                autoComplete="new-password"
                className="pe-14"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute end-2 top-[2.1rem] rounded px-1.5 py-1 text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:col-span-2">
              <Button type="submit" className="w-full sm:w-auto" loading={createUser.isPending}>
                <SiteIcon name="plus" size={16} /> Create account
              </Button>
              <AccessChips role={form.role} className="text-[var(--fg-muted)]" />
            </div>
          </form>
        </Panel>
      </div>

      <section className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            Staff
            <span className="text-xs font-normal text-[var(--fg-muted)]">
              {roleFilter ? `${items.length} ${STAFF_ROLE_LABELS[roleFilter].toLowerCase()}` : `${allStaff.length} total`}
            </span>
            {roleFilter ? (
              <button type="button" className="text-xs font-normal text-[var(--brand-text)] hover:underline" onClick={() => setRoleFilter('')}>
                Show all
              </button>
            ) : null}
          </h2>
          {allStaff.length > 5 ? (
            <div className="relative w-full sm:w-64">
              <SiteIcon name="search" size={14} className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" />
              <input
                type="search"
                aria-label="Search staff"
                placeholder="Name or email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-input)] ps-8 pe-2.5 text-sm text-[var(--fg)] outline-none ring-brand"
              />
            </div>
          ) : null}
        </div>

        {staff.isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : staff.isError ? (
          <QueryErrorState onRetry={() => staff.refetch()} />
        ) : (
          <>
            {/* Phones */}
            <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] md:hidden">
              {items.map((u) => {
                const isMe = String(me?._id) === String(u._id)
                return (
                  <li key={u._id} className="min-w-0 space-y-2 px-3 py-2.5">
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <Person u={u} isMe={isMe} />
                      <Badge variant="brand" className="shrink-0">
                        {roleLabel(u.role)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <RoleSelect u={u} isMe={isMe} />
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="shrink-0 text-[var(--danger)]"
                        disabled={isMe || removeRole.isPending}
                        loading={removeRole.isPending && removeRole.variables === u._id}
                        onClick={() => removeStaff(u)}
                      >
                        Remove
                      </Button>
                    </div>
                    <p className="text-[11px] text-[var(--fg-muted)]">Joined {u.createdAt ? formatDate(u.createdAt) : '—'}</p>
                  </li>
                )
              })}
              {!items.length ? (
                <li className="px-4 py-8 text-center text-sm text-[var(--fg-muted)]">
                  {allStaff.length ? 'No staff match.' : 'No staff accounts yet.'}
                </li>
              ) : null}
            </ul>

            {/* Tablet / desktop */}
            <div className="hidden min-w-0 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] md:block">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="border-b border-[var(--border)] text-xs text-[var(--fg-muted)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Staff</th>
                    <th className="w-44 px-3 py-2 font-medium">Role</th>
                    <th className="px-3 py-2 font-medium">Can open</th>
                    <th className="px-3 py-2 font-medium">Joined</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {items.map((u) => {
                    const isMe = String(me?._id) === String(u._id)
                    return (
                      <tr key={u._id} className="hover:bg-[var(--bg-muted)]">
                        <td className="max-w-[16rem] px-3 py-2">
                          <Person u={u} isMe={isMe} />
                        </td>
                        <td className="px-3 py-2">
                          <RoleSelect u={u} isMe={isMe} />
                        </td>
                        <td className="px-3 py-2">
                          {(ASSIGNABLE_ROLES as string[]).includes(u.role) ? <AccessChips role={u.role as AssignableRole} /> : null}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-[var(--fg-muted)]">{u.createdAt ? formatDate(u.createdAt) : '—'}</td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-[var(--danger)]"
                            disabled={isMe || removeRole.isPending}
                            loading={removeRole.isPending && removeRole.variables === u._id}
                            onClick={() => removeStaff(u)}
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                  {!items.length ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-[var(--fg-muted)]">
                        {allStaff.length ? 'No staff match.' : 'No staff accounts yet.'}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <Pagination page={page} pages={staff.data?.meta?.pages || 1} onChange={setPage} />
          </>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(roleChange)}
        title={roleChange ? `Change ${roleChange.user.name || roleChange.user.email} to ${STAFF_ROLE_LABELS[roleChange.role]}?` : ''}
        description={
          roleChange
            ? `They will be able to open: ${roleAccess(roleChange.role)
                .map((a) => `${a.label}${a.viewOnly ? ' (view only)' : ''}`)
                .join(', ')}. Pages of their current role close for them on their next page load.`
            : ''
        }
        confirmLabel="Change role"
        loading={changeRole.isPending}
        onClose={() => setRoleChange(null)}
        onConfirm={() => roleChange && changeRole.mutate({ id: roleChange.user._id, role: roleChange.role })}
      />

      <ConfirmDialog
        open={Boolean(removeTarget)}
        title="Remove staff access?"
        description={removeTarget ? `${removeTarget.name || removeTarget.email} will become a storefront customer and lose admin access.` : ''}
        confirmLabel="Remove access"
        loading={removeRole.isPending}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (removeTarget) {
            removeRole.mutate(removeTarget._id, {
              onSuccess: () => setRemoveTarget(null),
            })
          }
        }}
      />
    </div>
  )
}
