import { Order } from '../models/Order';
import { DepositReceipt } from '../models/DepositReceipt';
import { getSettings } from '../models/Settings';
import { ApiError } from '../utils/ApiError';
import { notifyStaffDepositReported } from './push.service';
import { invalidateDashboardCache } from './admin.service';

/** Receipts are resized in the browser first; this is a safety cap on the decoded image. */
const MAX_RECEIPT_BYTES = 1.5 * 1024 * 1024;

function decodeReceipt(dataUrl: string) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim());
  if (!match) throw new ApiError(400, 'The receipt must be a JPEG, PNG or WebP photo');
  const contentType = match[1];
  const data = Buffer.from(match[2], 'base64');
  if (!data.length || data.length > MAX_RECEIPT_BYTES) {
    throw new ApiError(400, 'The receipt photo is too large (1.5 MB max)');
  }
  const valid =
    contentType === 'image/jpeg'
      ? data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff
      : contentType === 'image/png'
        ? data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP';
  if (!valid) throw new ApiError(400, 'The receipt photo is invalid or corrupted');
  return { contentType, data };
}

/**
 * Customer: "I've paid the deposit" — how they paid, the transaction reference and/or a receipt
 * photo. The deposit stays awaiting until staff check it and mark it received. Can be sent again
 * (it replaces the previous report) while the deposit is awaiting.
 */
export async function reportDepositPayment(
  userId: string,
  orderNumber: string,
  input: { methodId: string; reference?: string; note?: string; receipt?: string }
) {
  const order = await Order.findOne({ orderNumber, user: userId });
  if (!order) throw new ApiError(404, 'Order not found');
  if (!order.deposit || !(order.deposit.amount > 0)) throw new ApiError(400, 'This order has no deposit');
  if (order.deposit.status === 'received') throw new ApiError(400, 'Your deposit has already been received');
  if (order.orderStatus !== 'pending' && order.orderStatus !== 'no_answer') {
    throw new ApiError(400, 'This order is no longer waiting for a deposit');
  }

  const methods = (await getSettings()).depositMethods ?? [];
  const method = methods.find((m) => m.id === input.methodId);
  if (!method && input.methodId !== 'other') throw new ApiError(400, 'Choose how you paid');

  const reference = input.reference?.trim() || undefined;
  const receipt = input.receipt ? decodeReceipt(input.receipt) : null;
  if (!reference && !receipt) {
    throw new ApiError(400, 'Add the transaction reference or a photo of the receipt');
  }

  if (receipt) {
    await DepositReceipt.findOneAndUpdate(
      { order: order._id },
      { order: order._id, data: receipt.data, contentType: receipt.contentType, size: receipt.data.length },
      { upsert: true }
    );
  }
  const hadReceipt = Boolean(order.deposit.payment?.hasReceipt);
  const methodName = method?.name || 'Other';
  order.deposit.payment = {
    methodId: method?.id ?? 'other',
    methodName,
    reference,
    note: input.note?.trim() || undefined,
    hasReceipt: Boolean(receipt) || hadReceipt,
    reportedAt: new Date(),
  };
  order.timeline.push({
    status: order.orderStatus,
    note: `Deposit payment reported by the customer (${methodName}${reference ? ` · ref ${reference}` : ''})`,
    at: new Date(),
  });
  order.markModified('deposit');
  await order.save();
  invalidateDashboardCache();

  try {
    await notifyStaffDepositReported(order);
  } catch (error) {
    console.error('Deposit report push failed', error);
  }
  return order;
}

/** Staff: the receipt photo a customer sent for an order's deposit. */
export async function getDepositReceipt(orderId: string) {
  const receipt = await DepositReceipt.findOne({ order: orderId });
  if (!receipt) throw new ApiError(404, 'No receipt for this order');
  return { data: receipt.data, contentType: receipt.contentType };
}
