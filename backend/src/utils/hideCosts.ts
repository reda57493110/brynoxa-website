import { hasPermission } from '../permissions';

const COST_KEYS = new Set(['unitCost', 'costPrice', 'unitCosts', 'costs']);

/** Purchase costs are for the owner (reports) and catalog staff who set cost prices. */
export function canSeeCosts(role: string | undefined | null) {
  return hasPermission(role, 'reports') || hasPermission(role, 'products:write');
}

/**
 * Removes purchase-cost fields (what the shop paid) from a response for staff who may not see
 * them, e.g. order/support staff recording a refund or a return.
 */
export function hideCostsFor<T>(role: string | undefined | null, data: T): T {
  if (canSeeCosts(role) || data === null || data === undefined) return data;
  const strip = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(strip);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).filter(([k]) => !COST_KEYS.has(k)).map(([k, v]) => [k, strip(v)]));
    }
    return value;
  };
  // Mongoose documents → plain JSON first (ObjectIds, dates become strings as in any response)
  return strip(JSON.parse(JSON.stringify(data))) as T;
}
