import { Order } from '../models/Order';
import { DepositReceipt } from '../models/DepositReceipt';
import { DepositProof } from '../models/DepositProof';
import { User } from '../models/User';
import { DEFAULT_ATM_CODES, getSettings } from '../models/Settings';
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
  input: {
    methodId: string;
    payerName?: string;
    senderPhone?: string;
    paidOn?: string;
    amountSent?: number;
    fee?: number;
    place?: string;
    codes?: { label: string; value: string }[];
    reference?: string;
    note?: string;
    receipt?: string;
  }
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
  const payerName = input.payerName?.trim() || undefined;
  const type = method?.type ?? 'other';

  // What each kind of payment needs
  let codes: { label: string; value: string }[] | undefined;
  if (type === 'atm') {
    const labels = method?.codeLabels?.length ? method.codeLabels : DEFAULT_ATM_CODES;
    const sent = new Map((input.codes ?? []).map((c) => [c.label, c.value.trim()]));
    codes = labels.map((label) => ({ label, value: sent.get(label) ?? '' }));
    const missing = codes.find((c) => !c.value);
    if (missing) throw new ApiError(400, `Enter the ${missing.label}`);
  } else if (['cashplus', 'wafacash', 'barid'].includes(type)) {
    if (!payerName) throw new ApiError(400, 'Enter the sender name written on the slip');
    if (!reference && !receipt) throw new ApiError(400, 'Enter the transfer code or add a photo of the slip');
  } else if (!reference && !receipt) {
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
    payerName,
    senderPhone: input.senderPhone?.trim() || undefined,
    paidOn: input.paidOn?.trim() || undefined,
    amountSent: typeof input.amountSent === 'number' ? Math.round(input.amountSent * 100) / 100 : undefined,
    fee: typeof input.fee === 'number' ? Math.round(input.fee * 100) / 100 : undefined,
    place: input.place?.trim() || undefined,
    codes,
    reference,
    note: input.note?.trim() || undefined,
    hasReceipt: Boolean(receipt) || hadReceipt,
    reportedAt: new Date(),
    source: 'customer',
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

export const MAX_DEPOSIT_PROOFS = 6;

/** Staff: add a proof photo (screenshot of the transfer, Cash Plus slip…) to an order's deposit. */
export async function addDepositProof(orderId: string, dataUrl: string, staffId?: string) {
  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, 'Order not found');
  if (!order.deposit || !(order.deposit.amount > 0)) throw new ApiError(400, 'Set a deposit amount first');
  const proofs = order.deposit.proofs ?? [];
  if (proofs.length >= MAX_DEPOSIT_PROOFS) {
    throw new ApiError(400, `Up to ${MAX_DEPOSIT_PROOFS} photos per deposit. Delete one first.`);
  }
  const image = decodeReceipt(dataUrl);
  const staff = staffId ? await User.findById(staffId).select('name').lean() : null;
  const doc = await DepositProof.create({
    order: order._id,
    data: image.data,
    contentType: image.contentType,
    size: image.data.length,
    addedBy: staffId,
  });
  order.deposit.proofs = [...proofs, { id: String(doc._id), addedAt: new Date(), addedByName: staff?.name }];
  order.timeline.push({ status: order.orderStatus, note: 'Deposit proof photo added', internal: true, at: new Date() });
  order.markModified('deposit');
  await order.save();
  return order;
}

/** Staff: delete a proof photo. */
export async function removeDepositProof(orderId: string, proofId: string) {
  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, 'Order not found');
  const proofs = order.deposit?.proofs ?? [];
  if (!order.deposit || !proofs.some((p) => p.id === proofId)) throw new ApiError(404, 'Photo not found');
  order.deposit.proofs = proofs.filter((p) => p.id !== proofId);
  order.markModified('deposit');
  await order.save();
  await DepositProof.deleteOne({ _id: proofId, order: order._id });
  return order;
}

async function proofImage(orderId: unknown, proofId: string) {
  if (!/^[a-f0-9]{24}$/i.test(proofId)) throw new ApiError(404, 'Photo not found');
  const proof = await DepositProof.findOne({ _id: proofId, order: orderId });
  if (!proof) throw new ApiError(404, 'Photo not found');
  return { data: proof.data, contentType: proof.contentType };
}

/** Staff: one proof photo. */
export function getDepositProofImage(orderId: string, proofId: string) {
  return proofImage(orderId, proofId);
}

/** Customer: a proof photo on their own order. */
export async function getMyDepositProofImage(userId: string, orderNumber: string, proofId: string) {
  const order = await Order.findOne({ orderNumber, user: userId }).select('_id').lean();
  if (!order) throw new ApiError(404, 'Order not found');
  return proofImage(order._id, proofId);
}
