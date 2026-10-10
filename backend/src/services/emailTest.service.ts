import { Types } from 'mongoose';
import { isEmailConfigured } from '../config/env';
import { Order } from '../models/Order';
import { User } from '../models/User';
import { getSettings, isEmailEnabled } from '../models/Settings';
import { ApiError } from '../utils/ApiError';
import {
  notifyDepositReceived,
  notifyDepositRequested,
  sendOrderPlacedCustomerEmail,
  sendOrderStatusEmail,
} from './orderNotify.service';

export const TEST_EMAIL_TYPES = [
  'orderPlaced',
  'orderConfirmed',
  'orderShipped',
  'orderDelivered',
  'orderCancelled',
  'depositRequested',
  'depositReceived',
] as const;
export type TestEmailType = (typeof TEST_EMAIL_TYPES)[number];

/** An unsaved sample order owned by `userId`, so the email goes to that staff member. */
function sampleOrder(userId: string, withDeposit: 'none' | 'pending' | 'received') {
  const items = [
    { product: new Types.ObjectId(), name: 'Brynoxa Pulse 1440 (sample)', sku: 'SAMPLE-PC', price: 14990, qty: 1 },
    { product: new Types.ObjectId(), name: 'Brynoxa Desk Cable Kit (sample)', sku: 'SAMPLE-CBL', price: 190, qty: 2 },
  ];
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const shipping = 40;
  return new Order({
    orderNumber: `TEST-${Date.now().toString(36).toUpperCase()}`,
    user: userId,
    items,
    pricing: { subtotal, discount: 0, shipping, tax: 0, total: subtotal + shipping },
    shippingAddress: {
      fullName: 'Sample Customer',
      line1: '12 Rue Exemple',
      city: 'Casablanca',
      phone: '0600000000',
    },
    deposit:
      withDeposit === 'none'
        ? undefined
        : { amount: 3000, source: 'admin', status: withDeposit, receivedAt: withDeposit === 'received' ? new Date() : undefined },
    timeline: [{ status: 'pending', note: 'Sample order for an email test', at: new Date() }],
  });
}

/** Sends one sample email of `type` to the signed-in staff member. Nothing is saved. */
export async function sendTestEmail(userId: string, type: TestEmailType) {
  if (!isEmailConfigured()) {
    throw new ApiError(503, 'Email is not set up on the server (RESEND_API_KEY and EMAIL_FROM).');
  }
  const [user, settings] = await Promise.all([User.findById(userId).select('email'), getSettings()]);
  if (!user?.email) throw new ApiError(400, 'Your account has no email address');
  if (!isEmailEnabled(settings, type)) {
    throw new ApiError(400, 'This email is switched off. Turn it on and save first.');
  }

  let sent = false;
  switch (type) {
    case 'orderPlaced':
      sent = await sendOrderPlacedCustomerEmail(sampleOrder(userId, 'none'));
      break;
    case 'orderConfirmed':
      sent = await sendOrderStatusEmail(sampleOrder(userId, 'none'), 'confirmed');
      break;
    case 'orderShipped':
      sent = await sendOrderStatusEmail(sampleOrder(userId, 'received'), 'shipped');
      break;
    case 'orderDelivered':
      sent = await sendOrderStatusEmail(sampleOrder(userId, 'received'), 'delivered');
      break;
    case 'orderCancelled':
      sent = await sendOrderStatusEmail(sampleOrder(userId, 'none'), 'cancelled');
      break;
    case 'depositRequested':
      sent = await notifyDepositRequested(sampleOrder(userId, 'pending'));
      break;
    case 'depositReceived':
      sent = await notifyDepositReceived(sampleOrder(userId, 'received'));
      break;
  }
  if (!sent) throw new ApiError(502, 'The email service did not accept the test email. Check the server logs.');
  return { sentTo: user.email };
}
