import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage, restoreSession } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Pagination } from '@/components/ui/Pagination'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { formatDate } from '@/lib/format'
import {
  STAFF_ROLE_LABELS,
  STAFF_ROLES,
  type StaffRole,
} from '@/lib/permissions'
import { toast } from '@/store/toastStore'
import { useAuthStore } from '@/store/authStore'
import type { User } from '@/types'

/** Hireable roles only — Owner is fixed and never assignable from this page. */
const ASSIGNABLE_ROLES = STAFF_ROLES.filter((r) => r !== 'admin')
const ROLE_OPTIONS = ASSIGNABLE_ROLES.map((value) => ({
  value,
  label: STAFF_ROLE_LABELS[value],
}))

export function Roles() {
  const qc = useQueryClient()
  const me = useAuthStore((s) => s.user)
  const [page, setPage] = useState(1)
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'orders' as StaffRole,
  })

  const staff = useQuery({
    queryKey: ['admin-users', { page, role: 'staff' }],
    queryFn: async () => {
      const res = await adminApi.users.list({
        limit: 20,
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
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: StaffRole }) =>
      adminApi.users.setRole(id, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('Role updated')
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

  const items = (staff.data?.items ?? []).filter((u) => u.role !== 'admin')
  const staffTotal = items.length

  const onCreate = (e: FormEvent) => {
    e.preventDefault()
    if (!form.email.trim() || !form.email.includes('@')) {
      toast.error('Enter a valid email')
      return
    }
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    if (form.role === 'admin') {
      toast.error('Owner role cannot be assigned')
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
    if (
      !confirm(
        `Remove staff access from ${user.name}? They will become a storefront customer.`
      )
    ) {
      return
    }
    removeRole.mutate(user._id)
  }

  const roleLabel = (role: string) =>
    STAFF_ROLE_LABELS[role as StaffRole] ?? role

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <AdminHeader title="Roles" description="Create and manage staff accounts." />

      <form
        onSubmit={onCreate}
        className="grid min-w-0 gap-3 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 sm:grid-cols-2 sm:rounded-2xl sm:p-5"
      >
        <h2 className="font-display text-sm font-semibold sm:col-span-2 sm:text-base">
          Create staff account
        </h2>
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
          onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as StaffRole }))}
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
        <Input
          label="Password"
          type="password"
          name="staff-password"
          placeholder="At least 6 characters"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          required
          autoComplete="new-password"
        />
        <div className="sm:col-span-2">
          <Button type="submit" className="w-full sm:w-auto" loading={createUser.isPending}>
            <SiteIcon name="plus" size={16} /> Create account
          </Button>
        </div>
      </form>

      <section className="min-w-0 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-sm font-semibold sm:text-base">Staff</h2>
          <p className="text-xs text-[var(--fg-muted)]">
            {staffTotal} total
          </p>
        </div>

        {staff.isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : (
          <>
            <div className="space-y-2.5 md:hidden">
              {items.map((u) => {
                const isMe = String(me?._id) === String(u._id)
                return (
                  <div
                    key={u._id}
                    className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3"
                  >
                    <div className="min-w-0 space-y-2">
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <p className="truncate text-sm font-medium">
                            {u.name}
                            {isMe ? (
                              <span className="ml-1 text-[11px] font-normal text-[var(--fg-muted)]">
                                (you)
                              </span>
                            ) : null}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-[var(--fg-muted)]">{u.email}</p>
                          <p className="truncate text-[11px] text-[var(--fg-muted)]">
                            Joined {u.createdAt ? formatDate(u.createdAt) : '—'}
                          </p>
                        </div>
                        <Badge variant="brand" className="shrink-0">
                          {roleLabel(u.role)}
                        </Badge>
                      </div>
                      <Select
                        label="Role"
                        value={u.role}
                        disabled={changeRole.isPending}
                        onChange={(e) =>
                          changeRole.mutate({
                            id: u._id,
                            role: e.target.value as StaffRole,
                          })
                        }
                        options={ROLE_OPTIONS}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        disabled={isMe || removeRole.isPending}
                        loading={removeRole.isPending && removeRole.variables === u._id}
                        onClick={() => removeStaff(u)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                )
              })}
              {!items.length ? (
                <p className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-8 text-center text-sm text-[var(--fg-muted)]">
                  No staff accounts yet.
                </p>
              ) : null}
            </div>

            <div className="hidden min-w-0 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] md:block">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-[var(--bg-muted)] text-[var(--fg-muted)]">
                  <tr>
                    <th className="px-4 py-3">Staff</th>
                    <th className="px-4 py-3">Joined</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((u) => {
                    const isMe = String(me?._id) === String(u._id)
                    return (
                      <tr key={u._id} className="border-t border-[var(--border)]">
                        <td className="max-w-[16rem] px-4 py-3">
                          <p className="truncate font-medium">
                            {u.name}
                            {isMe ? (
                              <span className="ml-1 text-xs font-normal text-[var(--fg-muted)]">
                                (you)
                              </span>
                            ) : null}
                          </p>
                          <p className="truncate text-xs text-[var(--fg-muted)]">{u.email}</p>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {u.createdAt ? formatDate(u.createdAt) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <Select
                            value={u.role}
                            disabled={changeRole.isPending}
                            onChange={(e) =>
                              changeRole.mutate({
                                id: u._id,
                                role: e.target.value as StaffRole,
                              })
                            }
                            options={ROLE_OPTIONS}
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
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
                </tbody>
              </table>
            </div>

            <Pagination
              page={page}
              pages={staff.data?.meta?.pages || 1}
              onChange={setPage}
            />
          </>
        )}
      </section>
    </div>
  )
}
