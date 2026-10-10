import { env } from '../config/env';
import { User } from '../models/User';
import { Order, OrderStatus } from '../models/Order';
import {
  getSettings,
  isEmailEnabled,
  type EmailMessageEvent,
  type ISettings,
} from '../models/Settings';
import { escapeHtml, sendEmail } from './email.service';
import {
  button,
  detailRows,
  formatMad,
  panel,
  paragraphs,
  renderEmail,
  siteUrl,
  toPlainText,
} from './emailTemplate';
import { notifyCustomerOrderStatus, notifyStaffNewOrder } from './push.service';

type OrderDoc = InstanceType<typeof Order>;

/** Short copy reused by in-app notifications and push messages. */
const STATUS_COPY: Record<OrderStatus, { title: string; customerLine: string }> = {
  pending: {
    title: 'Order placed',
    customerLine: 'We received your order and will confirm it shortly. Pay cash on delivery.',
  },
  confirmed: {
    title: 'Order confirmed',
    customerLine: 'Your order is confirmed and being prepared for shipping.',
  },
  shipped: {
    title: 'Order shipped',
    customerLine: 'Your order is on the way. The courier will contact you for cash on delivery.',
  },
  delivered: {
    title: 'Order delivered',
    customerLine: 'Your order was delivered. Thank you for shopping with Brynoxa.',
  },
  cancelled: {
    title: 'Order cancelled',
    customerLine: 'Your order was cancelled. Contact us on WhatsApp if you need help.',
  },
};

export function statusNotificationCopy(status: OrderStatus) {
  return STATUS_COPY[status];
}

/** Status changes that send a customer email, and the admin switch that controls each. */
const STATUS_EMAIL: Partial<Record<OrderStatus, EmailMessageEvent>> = {
  confirmed: 'orderConfirmed',
  shipped: 'orderShipped',
  delivered: 'orderDelivered',
  cancelled: 'orderCancelled',
};

export async function resolveCustomer(order: OrderDoc) {
  return User.findById(order.user).select('email name phone isGuest');
}

type Customer = NonNullable<Awaited<ReturnType<typeof resolveCustomer>>>;

/** Guests have no account page; they follow their order on the tracking page. */
export function orderLink(order: OrderDoc, customer: Customer) {
  return customer.isGuest
    ? siteUrl('/track-order')
    : siteUrl(`/account/orders/${encodeURIComponent(order.orderNumber)}`);
}

function adminOrderLink(orderId: string) {
  return siteUrl(`/admin/orders/${orderId}`);
}

function whatsappCustomerLink(phone?: string, orderNumber?: string) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  let intl = digits;
  if (digits.startsWith('0') && digits.length >= 9) intl = `212${digits.slice(1)}`;
  else if (!digits.startsWith('212') && digits.length === 9) intl = `212${digits}`;
  const text = orderNumber
    ? `Bonjour, concernant votre commande Brynoxa ${orderNumber}…`
    : 'Bonjour, Brynoxa…';
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
}

function greeting(order: OrderDoc, customer: Customer) {
  const name = (customer.name || order.shippingAddress?.fullName || '').trim().split(/\s+/)[0];
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">Hi ${escapeHtml(name || 'there')},</p>`;
}

function depositAmounts(order: OrderDoc) {
  const deposit = order.deposit?.amount && order.deposit.amount > 0 ? order.deposit : null;
  const paid = deposit?.status === 'received' ? deposit.amount : 0;
  return { deposit, paid, dueOnDelivery: Math.max(0, order.pricing.total - paid) };
}

/** Items, totals, payment method and deposit — the same block in every order email. */
export function orderSummaryHtml(order: OrderDoc, opts: { paid?: boolean } = {}) {
  const items = order.items
    .map(
      (item) => `<tr>
        <td style="padding:8px 0;font-size:14px;border-bottom:1px solid #e6ebef;">${escapeHtml(item.name)}<span style="color:#5a6a7a;"> × ${item.qty}</span></td>
        <td style="padding:8px 0;font-size:14px;border-bottom:1px solid #e6ebef;text-align:right;white-space:nowrap;">${formatMad(item.price * item.qty)}</td>
      </tr>`
    )
    .join('');

  const { deposit } = depositAmounts(order);
  const rows = [
    { label: 'Subtotal', value: formatMad(order.pricing.subtotal) },
    ...(order.pricing.discount > 0
      ? [{ label: `Discount${order.coupon?.code ? ` (${order.coupon.code})` : ''}`, value: `−${formatMad(order.pricing.discount)}` }]
      : []),
    { label: 'Shipping', value: order.pricing.shipping > 0 ? formatMad(order.pricing.shipping) : 'Free' },
    ...(order.pricing.tax > 0 ? [{ label: 'Tax', value: formatMad(order.pricing.tax) }] : []),
    { label: 'Total', value: formatMad(order.pricing.total), strong: true },
    { label: 'Payment method', value: opts.paid ? 'Cash on delivery — paid' : 'Cash on delivery' },
    ...(deposit && !opts.paid
      ? deposit.status === 'received'
        ? [
            { label: 'Deposit paid', value: formatMad(deposit.amount) },
            { label: 'Left to pay on delivery', value: formatMad(order.pricing.total - deposit.amount), strong: true },
          ]
        : [
            { label: 'Deposit to pay before confirmation', value: formatMad(deposit.amount), strong: true },
            { label: 'Then on delivery', value: formatMad(order.pricing.total - deposit.amount) },
          ]
      : []),
  ];

  return panel(
    `Order ${order.orderNumber}`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${items}</table>
     <div style="height:6px;"></div>${detailRows(rows)}`
  );
}

function deliveryHtml(order: OrderDoc) {
  const a = order.shippingAddress;
  const lines = [a.fullName, a.line1, a.line2, [a.city, a.state].filter(Boolean).join(', '), a.phone].filter(Boolean);
  return panel(
    'Delivery address',
    `<p style="margin:0;font-size:14px;line-height:1.6;">${lines.map((l) => escapeHtml(String(l))).join('<br/>')}</p>`
  );
}

function depositInstructionsHtml(settings: ISettings, amount: number) {
  const instructions = settings.depositInstructions?.trim();
  return panel(
    `Deposit to pay: ${formatMad(amount)}`,
    `${instructions ? paragraphs(instructions) : paragraphs('We will contact you with the payment details.')}
     <p style="margin:0;font-size:14px;line-height:1.6;color:#5a6a7a;">After paying, send your receipt on WhatsApp with your order number. We confirm your order as soon as the deposit is received.</p>`,
    'highlight'
  );
}

function customMessage(settings: ISettings, event: EmailMessageEvent) {
  const text = settings.emailMessages?.[event]?.trim();
  return text ? panel('A note from Brynoxa', paragraphs(text)) : '';
}

async function sendCustomerEmail(input: {
  to: string;
  subject: string;
  heading: string;
  preheader: string;
  body: string;
  idempotencyKey: string;
}) {
  const html = renderEmail({ heading: input.heading, preheader: input.preheader, body: input.body });
  return sendEmail({
    to: input.to,
    subject: input.subject,
    html,
    text: toPlainText(html),
    idempotencyKey: input.idempotencyKey,
  });
}

/** Customer + staff emails (and staff push) after a new COD order. Non-blocking for checkout. */
export async function notifyOrderPlaced(order: OrderDoc) {
  const staffPush = notifyStaffNewOrder(order).catch((error) => {
    console.error('Staff order push failed', error);
  });
  await notifyOrderPlacedEmails(order);
  await staffPush;
}

async function notifyOrderPlacedEmails(order: OrderDoc) {
  const [customer, settings] = await Promise.all([resolveCustomer(order), getSettings()]);
  await sendOrderPlacedCustomerEmail(order, customer, settings);
  await sendOrderPlacedStaffEmail(order, customer, settings);
}

/** Order confirmation to the customer. Returns false when skipped or not sent. */
export async function sendOrderPlacedCustomerEmail(
  order: OrderDoc,
  customer?: Customer | null,
  settings?: ISettings
): Promise<boolean> {
  customer ??= await resolveCustomer(order);
  settings ??= await getSettings();
  const { deposit } = depositAmounts(order);
  const id = String(order._id);
  if (!customer?.email || !isEmailEnabled(settings, 'orderPlaced')) return false;

  const intro = deposit
    ? 'Thank you for your order. We have received it. This order needs a deposit before we confirm it — the details are below. You pay the rest in cash when it arrives.'
    : 'Thank you for your order — we have received it. We will call or message you to confirm, then pack it within 1–2 business days. You pay in cash when it arrives.';
  return sendCustomerEmail({
    to: customer.email,
    subject: `Order ${order.orderNumber} received — Brynoxa`,
    heading: 'We received your order',
    preheader: `Order ${order.orderNumber} · ${formatMad(order.pricing.total)} · cash on delivery`,
    body: [
      greeting(order, customer),
      paragraphs(intro),
      deposit ? depositInstructionsHtml(settings, deposit.amount) : '',
      orderSummaryHtml(order),
      deliveryHtml(order),
      customMessage(settings, 'orderPlaced'),
      button(customer.isGuest ? 'Track your order' : 'View your order', orderLink(order, customer)),
    ].join(''),
    idempotencyKey: `order-placed/${id}`,
  });
}

async function sendOrderPlacedStaffEmail(order: OrderDoc, customer: Customer | null, settings: ISettings) {
  const { deposit } = depositAmounts(order);
  const id = String(order._id);
  const adminTo = env.ADMIN_EMAIL;
  if (adminTo && isEmailEnabled(settings, 'staffNewOrder')) {
    const wa = whatsappCustomerLink(order.shippingAddress?.phone || customer?.phone, order.orderNumber);
    const html = renderEmail({
      heading: `New order ${order.orderNumber}`,
      preheader: `${order.shippingAddress.fullName} · ${order.shippingAddress.city} · ${formatMad(order.pricing.total)}`,
      body: [
        paragraphs(
          `A new cash-on-delivery order was placed by ${order.shippingAddress.fullName} (${order.shippingAddress.phone}).`
        ),
        deposit ? paragraphs(`Deposit required: ${formatMad(deposit.amount)} — confirm only after it is received.`) : '',
        orderSummaryHtml(order),
        deliveryHtml(order),
        button('Open in admin', adminOrderLink(id)),
        wa ? `<p style="margin:6px 0 0;font-size:14px;"><a href="${wa}" style="color:#0077a8;">WhatsApp the customer</a></p>` : '',
      ].join(''),
    });
    await sendEmail({
      to: adminTo,
      subject: `New order ${order.orderNumber} — ${formatMad(order.pricing.total)}`,
      html,
      text: toPlainText(html),
      idempotencyKey: `order-placed-staff/${id}`,
    });
  }
}

function statusEmailContent(order: OrderDoc, status: OrderStatus, settings: ISettings) {
  const { deposit, paid, dueOnDelivery } = depositAmounts(order);
  switch (status) {
    case 'confirmed':
      return {
        subject: `Order ${order.orderNumber} confirmed — Brynoxa`,
        heading: 'Your order is confirmed',
        preheader: 'We are preparing your order for shipping.',
        intro: `Good news — your order is confirmed and we are preparing it. It is usually packed within 1–2 business days, and delivery takes 2–5 days depending on your city.${paid ? '' : ` You pay ${formatMad(dueOnDelivery)} in cash on delivery.`}`,
      };
    case 'shipped':
      return {
        subject: `Order ${order.orderNumber} is on its way — Brynoxa`,
        heading: 'Your order is on its way',
        preheader: `Have ${formatMad(dueOnDelivery)} ready for the courier.`,
        intro: `Your order has left our warehouse. The courier will call you before delivery. Please have ${formatMad(dueOnDelivery)} ready in cash — check the package before you pay.`,
      };
    case 'delivered':
      return {
        subject: `Order ${order.orderNumber} delivered — Brynoxa`,
        heading: 'Your order was delivered',
        preheader: 'Payment received — thank you for shopping with Brynoxa.',
        intro: 'Your order was delivered and your payment has been received. Thank you for shopping with Brynoxa! Your 6-month warranty starts today — keep this email and your order number as proof of purchase.',
        extra: panel(
          'Payment received',
          detailRows([
            ...(paid ? [{ label: 'Deposit paid earlier', value: formatMad(paid) }] : []),
            { label: 'Paid in cash on delivery', value: formatMad(dueOnDelivery) },
            { label: 'Total paid', value: formatMad(order.pricing.total), strong: true },
          ]),
          'highlight'
        ),
      };
    case 'cancelled': {
      const lastNote = [...order.timeline].reverse().find((t) => t.status === 'cancelled')?.note;
      const reason = lastNote && !/^Status changed to/i.test(lastNote) ? ` Reason: ${lastNote}.` : '';
      const refund = deposit?.status === 'received'
        ? ` Your deposit of ${formatMad(deposit.amount)} will be refunded — we will contact you to arrange it.`
        : '';
      return {
        subject: `Order ${order.orderNumber} cancelled — Brynoxa`,
        heading: 'Your order was cancelled',
        preheader: `Order ${order.orderNumber} has been cancelled.`,
        intro: `Your order ${order.orderNumber} has been cancelled.${reason}${refund} If this is a mistake or you have a question, message us on WhatsApp and we will help.`,
      };
    }
    default:
      void settings;
      return null;
  }
}

/** Customer email + push when an order's status actually changes. */
export async function notifyOrderStatusChanged(order: OrderDoc, status: OrderStatus): Promise<boolean> {
  const customer = await resolveCustomer(order);
  await notifyCustomerOrderStatus(order, status, { isGuest: Boolean(customer?.isGuest) }).catch((error) => {
    console.error('Customer order push failed', error);
  });
  return sendOrderStatusEmail(order, status, customer);
}

/** The status email alone (no push). Returns false when skipped or not sent. */
export async function sendOrderStatusEmail(
  order: OrderDoc,
  status: OrderStatus,
  customer?: Customer | null
): Promise<boolean> {
  customer ??= await resolveCustomer(order);
  const event = STATUS_EMAIL[status];
  if (!event || !customer?.email) return false;
  const settings = await getSettings();
  if (!isEmailEnabled(settings, event)) return false;

  const content = statusEmailContent(order, status, settings);
  if (!content) return false;

  return sendCustomerEmail({
    to: customer.email,
    subject: content.subject,
    heading: content.heading,
    preheader: content.preheader,
    body: [
      greeting(order, customer),
      paragraphs(content.intro),
      'extra' in content ? content.extra : '',
      status === 'cancelled' ? '' : orderSummaryHtml(order, { paid: status === 'delivered' }),
      status === 'confirmed' || status === 'shipped' ? deliveryHtml(order) : '',
      customMessage(settings, event),
      button(customer.isGuest ? 'Track your order' : 'View your order', orderLink(order, customer)),
    ].join(''),
    idempotencyKey: `order-status/${String(order._id)}/${status}`,
  });
}

/** Staff set or changed the deposit on an order: tell the customer what to pay and how. */
export async function notifyDepositRequested(order: OrderDoc): Promise<boolean> {
  const { deposit } = depositAmounts(order);
  if (!deposit || deposit.status !== 'pending') return false;
  const [customer, settings] = await Promise.all([resolveCustomer(order), getSettings()]);
  if (!customer?.email || !isEmailEnabled(settings, 'depositRequested')) return false;

  return sendCustomerEmail({
    to: customer.email,
    subject: `Deposit needed for order ${order.orderNumber} — Brynoxa`,
    heading: 'A deposit is needed to confirm your order',
    preheader: `Deposit ${formatMad(deposit.amount)} · the rest on delivery`,
    body: [
      greeting(order, customer),
      paragraphs(
        `To confirm order ${order.orderNumber}, we need a deposit of ${formatMad(deposit.amount)}. You pay the remaining ${formatMad(order.pricing.total - deposit.amount)} in cash on delivery.`
      ),
      depositInstructionsHtml(settings, deposit.amount),
      orderSummaryHtml(order),
      customMessage(settings, 'depositRequested'),
      button(customer.isGuest ? 'Track your order' : 'View your order', orderLink(order, customer)),
    ].join(''),
    idempotencyKey: `deposit-requested/${String(order._id)}/${deposit.amount}`,
  });
}

/** Staff marked the deposit as received: payment confirmation with the remaining balance. */
export async function notifyDepositReceived(order: OrderDoc): Promise<boolean> {
  const { deposit } = depositAmounts(order);
  if (!deposit || deposit.status !== 'received') return false;
  const [customer, settings] = await Promise.all([resolveCustomer(order), getSettings()]);
  if (!customer?.email || !isEmailEnabled(settings, 'depositReceived')) return false;

  return sendCustomerEmail({
    to: customer.email,
    subject: `Deposit received for order ${order.orderNumber} — Brynoxa`,
    heading: 'We received your deposit',
    preheader: `${formatMad(deposit.amount)} received · ${formatMad(order.pricing.total - deposit.amount)} left on delivery`,
    body: [
      greeting(order, customer),
      paragraphs('Thank you — we received your deposit. We will now confirm and prepare your order.'),
      panel(
        'Payment received',
        detailRows([
          { label: 'Deposit received', value: formatMad(deposit.amount), strong: true },
          { label: 'Left to pay on delivery', value: formatMad(order.pricing.total - deposit.amount) },
          { label: 'Order total', value: formatMad(order.pricing.total) },
        ]),
        'highlight'
      ),
      orderSummaryHtml(order),
      customMessage(settings, 'depositReceived'),
      button(customer.isGuest ? 'Track your order' : 'View your order', orderLink(order, customer)),
    ].join(''),
    idempotencyKey: `deposit-received/${String(order._id)}/${deposit.receivedAt?.getTime() ?? deposit.amount}`,
  });
}
