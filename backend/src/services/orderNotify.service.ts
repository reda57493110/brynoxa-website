import { env } from '../config/env';
import { User } from '../models/User';
import { Order, OrderStatus } from '../models/Order';
import { escapeHtml, sendEmail } from './email.service';

const STATUS_COPY: Record<
  OrderStatus,
  { title: string; customerLine: string }
> = {
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

function formatMad(amount: number) {
  return `${Math.round(amount).toLocaleString('fr-MA')} DH`;
}

function orderItemsHtml(order: InstanceType<typeof Order>) {
  const rows = order.items
    .map(
      (item) =>
        `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #e8ecef;">${escapeHtml(item.name)} × ${item.qty}</td>
          <td style="padding:8px 0;border-bottom:1px solid #e8ecef;text-align:right;">${formatMad(item.price * item.qty)}</td>
        </tr>`
    )
    .join('');
  return `<table style="width:100%;border-collapse:collapse;font-size:14px;">${rows}</table>`;
}

function wrapEmail(title: string, body: string) {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f5f7f9;font-family:Manrope,Segoe UI,Arial,sans-serif;color:#0c1218;">
  <div style="max-width:560px;margin:24px auto;background:#ffffff;border:1px solid #d5dde4;border-radius:16px;overflow:hidden;">
    <div style="padding:20px 24px;background:#080B0E;color:#fff;">
      <div style="font-size:18px;font-weight:700;letter-spacing:-0.02em;">Brynoxa</div>
      <div style="margin-top:4px;font-size:13px;color:#7adfff;">${escapeHtml(title)}</div>
    </div>
    <div style="padding:24px;">${body}</div>
    <div style="padding:16px 24px;border-top:1px solid #e8ecef;font-size:12px;color:#5a6a7a;">
      Questions? WhatsApp <a href="https://wa.me/212779318061" style="color:#0077a8;">07 79 31 80 61</a>
      · <a href="mailto:brynoxa.com@gmail.com" style="color:#0077a8;">brynoxa.com@gmail.com</a>
    </div>
  </div>
</body></html>`;
}

function customerOrderLink(orderNumber: string) {
  return `${env.CLIENT_URL}/account/orders/${encodeURIComponent(orderNumber)}`;
}

function adminOrderLink(orderId: string) {
  return `${env.CLIENT_URL}/admin/orders/${orderId}`;
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

async function resolveCustomerEmail(order: InstanceType<typeof Order>) {
  const user = await User.findById(order.user).select('email name phone isGuest');
  return user;
}

export function statusNotificationCopy(status: OrderStatus) {
  return STATUS_COPY[status];
}

/** Customer + admin emails after a new COD order (non-blocking). */
export async function notifyOrderPlaced(order: InstanceType<typeof Order>) {
  const user = await resolveCustomerEmail(order);
  const copy = STATUS_COPY.pending;
  const total = formatMad(order.pricing.total);
  const orderUrl = customerOrderLink(order.orderNumber);
  const waCustomer = whatsappCustomerLink(order.shippingAddress?.phone || user?.phone, order.orderNumber);

  if (user?.email) {
    await sendEmail({
      to: user.email,
      subject: `Brynoxa — ${copy.title} ${order.orderNumber}`,
      html: wrapEmail(
        copy.title,
        `<p>Hi ${escapeHtml(user.name || order.shippingAddress.fullName)},</p>
         <p>${escapeHtml(copy.customerLine)}</p>
         <p><strong>Order</strong> ${escapeHtml(order.orderNumber)}<br/>
         <strong>Total</strong> ${total} (cash on delivery)<br/>
         <strong>City</strong> ${escapeHtml(order.shippingAddress.city)}</p>
         ${orderItemsHtml(order)}
         <p style="margin-top:20px;"><a href="${orderUrl}" style="display:inline-block;background:#00c2ff;color:#041018;text-decoration:none;font-weight:700;padding:10px 16px;border-radius:999px;">View order</a></p>`
      ),
    });
  }

  const adminTo = env.ADMIN_EMAIL || undefined;
  if (adminTo) {
    await sendEmail({
      to: adminTo,
      subject: `New COD order ${order.orderNumber} — ${total}`,
      html: wrapEmail(
        'New order',
        `<p>A new cash-on-delivery order was placed.</p>
         <p><strong>${escapeHtml(order.orderNumber)}</strong> · ${total}<br/>
         ${escapeHtml(order.shippingAddress.fullName)} · ${escapeHtml(order.shippingAddress.phone)}<br/>
         ${escapeHtml(order.shippingAddress.line1)}, ${escapeHtml(order.shippingAddress.city)}</p>
         ${orderItemsHtml(order)}
         <p style="margin-top:20px;">
           <a href="${adminOrderLink(String(order._id))}" style="display:inline-block;background:#00c2ff;color:#041018;text-decoration:none;font-weight:700;padding:10px 16px;border-radius:999px;margin-right:8px;">Open in admin</a>
           ${
             waCustomer
               ? `<a href="${waCustomer}" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;font-weight:700;padding:10px 16px;border-radius:999px;">WhatsApp customer</a>`
               : ''
           }
         </p>`
      ),
    });
  }
}

/** Customer email when admin (or system) changes order status. */
export async function notifyOrderStatusChanged(
  order: InstanceType<typeof Order>,
  status: OrderStatus
) {
  const user = await resolveCustomerEmail(order);
  if (!user?.email) return;

  const copy = STATUS_COPY[status];
  const orderUrl = customerOrderLink(order.orderNumber);

  await sendEmail({
    to: user.email,
    subject: `Brynoxa — ${copy.title} (${order.orderNumber})`,
    html: wrapEmail(
      copy.title,
      `<p>Hi ${escapeHtml(user.name || order.shippingAddress.fullName)},</p>
       <p>${escapeHtml(copy.customerLine)}</p>
       <p><strong>Order</strong> ${escapeHtml(order.orderNumber)}<br/>
       <strong>Status</strong> ${escapeHtml(status)}<br/>
       <strong>Total</strong> ${formatMad(order.pricing.total)}</p>
       <p style="margin-top:20px;"><a href="${orderUrl}" style="display:inline-block;background:#00c2ff;color:#041018;text-decoration:none;font-weight:700;padding:10px 16px;border-radius:999px;">Track order</a></p>`
    ),
  });
}
