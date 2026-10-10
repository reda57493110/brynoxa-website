import mongoose from 'mongoose';
import { isEmailConfigured } from '../config/env';
import { Order } from '../models/Order';
import { SentEmail } from '../models/SentEmail';
import { getSettings } from '../models/Settings';
import { User } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { escapeHtml, sendEmail } from './email.service';
import { button, paragraphs, renderEmail, toPlainText } from './emailTemplate';
import { orderLink, orderSummaryHtml, resolveCustomer } from './orderNotify.service';

/**
 * Staff-written email to one customer, in the Brynoxa layout.
 * Optionally attaches an order (summary + "View your order" button). Every send is logged.
 */
export async function sendManualEmail(input: {
  to: string;
  subject: string;
  message: string;
  orderId?: string;
  sentBy: string;
}) {
  if (!isEmailConfigured()) {
    throw new ApiError(503, 'Email is not set up on the server (RESEND_API_KEY and EMAIL_FROM).');
  }
  const to = input.to.trim().toLowerCase();

  let order: InstanceType<typeof Order> | null = null;
  if (input.orderId) {
    if (!mongoose.Types.ObjectId.isValid(input.orderId)) throw new ApiError(404, 'Order not found');
    order = await Order.findById(input.orderId);
    if (!order) throw new ApiError(404, 'Order not found');
  }

  const [settings, account, orderCustomer] = await Promise.all([
    getSettings(),
    User.findOne({ email: to }).select('name'),
    order ? resolveCustomer(order) : Promise.resolve(null),
  ]);
  const name = (account?.name || order?.shippingAddress?.fullName || '').trim().split(/\s+/)[0];

  const html = renderEmail({
    heading: input.subject,
    preheader: input.message.slice(0, 120),
    body: [
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">Hi ${escapeHtml(name || 'there')},</p>`,
      paragraphs(input.message),
      order ? orderSummaryHtml(order) : '',
      order && orderCustomer ? button('View your order', orderLink(order, orderCustomer)) : '',
    ].join(''),
  });

  const sent = await sendEmail({
    to,
    subject: input.subject,
    html,
    text: toPlainText(html),
    replyTo: settings.supportEmail || undefined,
  });

  await SentEmail.create({
    to,
    subject: input.subject,
    message: input.message,
    order: order?._id,
    orderNumber: order?.orderNumber,
    sentBy: input.sentBy,
    status: sent ? 'sent' : 'failed',
  });

  if (!sent) throw new ApiError(502, 'The email service did not accept this email. Check the server logs.');
  return { sentTo: to };
}

export async function listSentEmails(page = 1, limit = 20, to?: string) {
  const filter: Record<string, unknown> = {};
  if (to?.trim()) filter.to = to.trim().toLowerCase();
  const [items, total] = await Promise.all([
    SentEmail.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('sentBy', 'name email')
      .lean(),
    SentEmail.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}
