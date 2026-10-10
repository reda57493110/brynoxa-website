import { roundMoney } from './deposit';

/** A wholesale pricing tier defined in Settings (e.g. "Tier A", 10 % off list price). */
export interface WholesaleTier {
  id: string;
  name: string;
  discountPercent: number;
}

/** Pricing a customer is entitled to; snapshotted on each wholesale order. */
export interface WholesaleTerms {
  tierId: string;
  tierName: string;
  discountPercent: number;
}

/** Unit price after the tier discount. Mirrored in frontend/src/lib/wholesale.ts. */
export function wholesaleUnitPrice(listPrice: number, discountPercent: number) {
  const pct = Math.min(Math.max(discountPercent, 0), 90);
  return roundMoney(listPrice * (1 - pct / 100));
}

/** Validates tiers from admin input: unique ids, names, 0–90 % discounts, max 10 tiers. */
export function sanitizeWholesaleTiers(input: unknown): WholesaleTier[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: WholesaleTier[] = [];
  for (const row of input) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const name = String(r.name ?? '').trim().slice(0, 40);
    const discountPercent = Number(r.discountPercent);
    let id = String(r.id ?? '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24);
    if (!id) id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);
    if (!name || !id || seen.has(id) || !Number.isFinite(discountPercent)) continue;
    if (discountPercent < 0 || discountPercent > 90) continue;
    seen.add(id);
    out.push({ id, name, discountPercent: roundMoney(discountPercent) });
    if (out.length >= 10) break;
  }
  return out;
}
