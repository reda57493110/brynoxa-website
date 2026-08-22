/** Staff roles that can open /admin (customers cannot). */
export const STAFF_ROLES = ['admin', 'orders', 'catalog', 'support', 'marketing'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export type AppRole = StaffRole | 'customer';

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
  | 'settings';

const ALL_PERMISSIONS: Permission[] = [
  'dashboard',
  'orders:read',
  'orders:write',
  'products:read',
  'products:write',
  'products:delete',
  'inventory:write',
  'customers:read',
  'customers:write',
  'users:manage',
  'messages',
  'reviews',
  'coupons',
  'settings',
];

export const ROLE_PERMISSIONS: Record<StaffRole, Permission[] | ['*']> = {
  admin: ['*'],
  orders: ['orders:read', 'orders:write', 'customers:read'],
  catalog: ['products:read', 'products:write', 'products:delete', 'inventory:write'],
  support: ['orders:read', 'orders:write', 'messages', 'customers:read'],
  marketing: ['coupons', 'reviews'],
};

export function isStaffRole(role: string | undefined | null): role is StaffRole {
  return Boolean(role && (STAFF_ROLES as readonly string[]).includes(role));
}

export function hasPermission(role: string | undefined | null, permission: Permission): boolean {
  if (!isStaffRole(role)) return false;
  const perms = ROLE_PERMISSIONS[role];
  if (perms[0] === '*') return true;
  return (perms as Permission[]).includes(permission);
}

export function permissionsFor(role: string | undefined | null): Permission[] {
  if (!isStaffRole(role)) return [];
  const perms = ROLE_PERMISSIONS[role];
  if (perms[0] === '*') return ALL_PERMISSIONS;
  return perms as Permission[];
}
