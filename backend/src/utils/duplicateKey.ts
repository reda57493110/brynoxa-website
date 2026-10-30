/** Field names of unique indexes → what the person is told when the value is already taken. */
const TAKEN: Record<string, string> = {
  sku: 'This SKU is already used by another product',
  slug: 'This name is already used — choose a different one',
  email: 'This email is already registered',
  code: 'This code is already used',
  serial: 'One of these serial numbers is already registered',
  orderNumber: 'This order number already exists — please try again',
  name: 'This name is already used — choose a different one',
};

/**
 * MongoDB refuses a second record with the same unique value (error code 11000). That is the
 * person's input, not a server failure: 409 with a message naming what is already taken.
 */
export function duplicateKeyMessage(err: unknown): string | null {
  if (!err || typeof err !== 'object' || (err as { code?: unknown }).code !== 11000) return null;
  const fields = Object.keys((err as { keyPattern?: Record<string, unknown> }).keyPattern ?? {});
  const field = fields.find((f) => TAKEN[f]) ?? fields[fields.length - 1];
  return (field && TAKEN[field]) || 'This already exists';
}
