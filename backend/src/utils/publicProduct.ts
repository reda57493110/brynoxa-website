/**
 * Product fields for the shop's own use only: how many were sold and where the stock sits.
 * Never sent to shoppers (lists, product page, compare, wishlist, recommendations); the admin
 * still gets them. Sorting by best sellers still works (it happens in the database).
 */
export const PRIVATE_PRODUCT_FIELDS = ['soldCount', 'inventoryLocation'] as const;

/** Mongoose select that leaves them out. */
export const HIDE_PRIVATE_PRODUCT_FIELDS = PRIVATE_PRODUCT_FIELDS.map((f) => `-${f}`).join(' ');

/** Removes them from a product already loaded (when they were needed for ranking first). */
export function withoutPrivateFields<T extends object>(product: T): T {
  const copy = { ...product } as Record<string, unknown>;
  for (const field of PRIVATE_PRODUCT_FIELDS) delete copy[field];
  return copy as T;
}
