/** Staff roles that can open /admin (customers cannot). */
export const STAFF_ROLES = ['admin', 'orders', 'catalog', 'support', 'marketing'] as const
export type StaffRole = (typeof STAFF_ROLES)[number]
export type AppRole = StaffRole | 'customer'

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  admin: 'Owner',
  orders: 'Orders',
  catalog: 'Catalog',
  support: 'Support',
  marketing: 'Marketing',
}

/** Capability keys used by API + sidebar. */
export type Permission =
  | 'dashboard'
  | 'orders:read'
  | 'orders:write'
  | 'products:read'
  | 'products:write'
  | 'products:delete'
  | 'inventory:write'
  | 'customers:read'
  | 'customers:write'
  | 'users:manage'
  | 'messages'
  | 'reviews'
  | 'coupons'
  | 'push'
  | 'settings'
  /** Cost, profit and margin figures */
  | 'reports'
  /** Approve repaired units for sale, write off stock, adjust counts */
  | 'inventory:approve'

/** Owner alone gets the full dashboard; other roles land on their workspace. */
export const ROLE_PERMISSIONS: Record<StaffRole, Permission[] | ['*']> = {
  admin: ['*'],
  orders: ['orders:read', 'orders:write', 'customers:read'],
  catalog: ['products:read', 'products:write', 'products:delete', 'inventory:write'],
  support: ['orders:read', 'orders:write', 'messages', 'customers:read'],
  marketing: ['coupons', 'reviews', 'push'],
}

/** First page each role opens after login. */
export function staffHomePath(role: string | undefined | null): string {
  switch (role) {
    case 'orders':
      return '/admin/orders'
    case 'catalog':
      return '/admin/products'
    case 'support':
      return '/admin/messages'
    case 'marketing':
      return '/admin/coupons'
    case 'admin':
    default:
      return '/admin'
  }
}

export function isStaffRole(role: string | undefined | null): role is StaffRole {
  return Boolean(role && (STAFF_ROLES as readonly string[]).includes(role))
}

export function hasPermission(role: string | undefined | null, permission: Permission): boolean {
  if (!isStaffRole(role)) return false
  const perms = ROLE_PERMISSIONS[role]
  if (perms[0] === '*') return true
  return (perms as Permission[]).includes(permission)
}

/** Sidebar / route path → required permission */
export const ADMIN_NAV_PERMISSION: Record<string, Permission> = {
  '/admin': 'dashboard',
  '/admin/orders': 'orders:read',
  '/admin/products': 'products:read',
  '/admin/inventory': 'inventory:write',
  '/admin/customers': 'customers:read',
  '/admin/roles': 'users:manage',
  '/admin/messages': 'messages',
  '/admin/emails': 'messages',
  '/admin/coupons': 'coupons',
  '/admin/notifications': 'push',
  '/admin/settings': 'settings',
}
