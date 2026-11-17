import mongoose from 'mongoose';

/**
 * Order confirmations go to the address typed at checkout, so fake orders could send mail to
 * anyone and use up the shop's email quota. A daily budget per address and for the whole shop;
 * past it the order is still placed, only the email is skipped. Counted in `rate_limits` (TTL).
 */
export const ORDER_EMAILS_PER_ADDRESS_PER_DAY = 3;
export const ORDER_EMAILS_PER_DAY = 60;
const DAY = 86_400_000;

type Counter = { _id: string; count: number; expiresAt: Date };

export async function orderEmailAllowed(address: string): Promise<boolean> {
  const db = mongoose.connection.db;
  if (!db) return true;
  const day = Math.floor(Date.now() / DAY) * DAY;
  const col = db.collection<Counter>('rate_limits');
  const bump = async (key: string) => {
    const r = await col.findOneAndUpdate(
      { _id: key },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(day + DAY) } },
      { upsert: true, returnDocument: 'after' }
    );
    const doc = (r && typeof (r as unknown as Counter).count === 'number' ? r : (r as unknown as { value?: Counter })?.value) as Counter | null;
    return doc?.count ?? 1;
  };
  try {
    if ((await bump(`orderMail:${address.trim().toLowerCase().slice(0, 200)}:${day}`)) > ORDER_EMAILS_PER_ADDRESS_PER_DAY) return false;
    return (await bump(`orderMailAll:${day}`)) <= ORDER_EMAILS_PER_DAY;
  } catch {
    return true;
  }
}
