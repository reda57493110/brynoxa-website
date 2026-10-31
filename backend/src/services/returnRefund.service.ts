import { Order } from '../models/Order';
import { ApiError } from '../utils/ApiError';
import { roundMoney } from '../utils/deposit';
import { wasDelivered } from '../utils/orderStatus';
import { amountPaidOnOrder, backfillDeliveredAt, recordRefund } from './order.service';
import { assessReturn, createReturn } from './inventoryOps.service';

export type ReturnRefundReason = 'defective' | 'wrong-item' | 'changed-mind';
export type RefundMethod = 'cash' | 'transfer' | 'other';
/** What happens to the product: checked later in Inventory → Returns, back on sale, or written off. */
export type ReturnRefundOutcome = 'inspect' | 'restock' | 'write-off';

const REASON_TEXT: Record<ReturnRefundReason, string> = {
  defective: 'Defective / problem',
  'wrong-item': 'Wrong item',
  'changed-mind': 'Changed mind',
};
const METHOD_TEXT: Record<RefundMethod, string> = { cash: 'cash', transfer: 'bank transfer', other: 'other' };

/**
 * Admin → order → "Return & refund": a delivered sale is undone in one step — the products come
 * back (order: returned / partially returned), the money given back is recorded, and the product
 * goes to the chosen place in stock. Everything is checked before anything is changed (amount,
 * quantities, approval rights), then the usual steps run in order: createReturn, recordRefund,
 * assessReturn (unless it is checked later).
 */
export async function returnAndRefund(
  orderId: string,
  input: {
    lines: { productId: string; qty: number; serials?: string[] }[];
    reason: ReturnRefundReason;
    note?: string;
    amount: number;
    method: RefundMethod;
    outcome: ReturnRefundOutcome;
  },
  actor: { id: string; canApprove: boolean }
) {
  const order = await Order.findById(orderId).select('+items.unitCost');
  if (!order) throw new ApiError(404, 'Order not found');
  backfillDeliveredAt(order);
  if (!wasDelivered(order)) {
    throw new ApiError(400, 'Only delivered orders can be returned and refunded. For a parcel that came back, use "Returned items".');
  }
  if (input.outcome === 'write-off' && !actor.canApprove) {
    throw new ApiError(403, 'Writing off a product needs inventory approval rights: choose "Check it first"');
  }
  const paid = amountPaidOnOrder(order);
  const refunded = (order.refunds || []).reduce((sum, r) => sum + r.amount, 0);
  const refundable = roundMoney(paid - refunded);
  const amount = roundMoney(input.amount);
  if (amount < 0 || amount > refundable + 0.005) {
    throw new ApiError(400, `The money given back must be between 0 and ${refundable.toLocaleString('en-US')} DH`);
  }
  const note = input.note?.trim();
  const reason = `${REASON_TEXT[input.reason]}${note ? `: ${note}` : ''}`.slice(0, 300);

  // 1. The products come back (quantities and serial numbers checked there)
  const ret = await createReturn(
    { orderId, lines: input.lines.map((l) => ({ ...l, reason, conditionNote: note })) },
    actor
  );

  // 2. The money given back
  if (amount > 0) {
    await recordRefund(
      orderId,
      { amount, reason: `${reason} — paid back by ${METHOD_TEXT[input.method]}`.slice(0, 300), itemsReturned: true, method: input.method },
      actor.id
    );
  }

  // 3. Where the product goes (or it waits in Inventory → Returns to be checked)
  if (input.outcome !== 'inspect') {
    for (const line of ret.lines) {
      const lineId = String((line as unknown as { _id: unknown })._id);
      await assessReturn(
        String(ret._id),
        {
          lineId,
          qty: line.qty,
          outcome: input.outcome === 'restock' ? 'restock-new' : 'write-off',
          // "Back on sale" in the dialog is the staff member confirming it works and is as sold
          meetsNewCriteria: input.outcome === 'restock' ? true : undefined,
          note: input.outcome === 'restock' ? 'Back on sale (Return & refund)' : `Written off (Return & refund): ${reason}`,
          serials: line.serials?.length ? line.serials : undefined,
        },
        actor
      );
    }
  }

  return { returnId: String(ret._id) };
}
