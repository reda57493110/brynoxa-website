import { createHash } from 'crypto';
import webpush from 'web-push';
import { env } from '../config/env';
import {
  PushCampaign,
  PushSubscription,
  type PushLocale,
} from '../models/PushSubscription';
import { Order, type OrderStatus } from '../models/Order';
import { User } from '../models/User';
import { hasPermission, STAFF_ROLES } from '../permissions';
import { ApiError } from '../utils/ApiError';

const DEFAULT_SUBJECT = 'mailto:reda.lazrak2004@gmail.com';
const SEND_BATCH_SIZE = 100;
const PUSH_TTL_SECONDS = 24 * 60 * 60;
const LOCALES: PushLocale[] = ['fr', 'ar', 'en'];

let vapidReady = false;

function ensureVapid(): boolean {
  if (vapidReady) return true;
  const publicKey = env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(env.VAPID_SUBJECT?.trim() || DEFAULT_SUBJECT, publicKey, privateKey);
  vapidReady = true;
  return true;
}

export function getPushPublicKey(): string | null {
  return ensureVapid() ? env.VAPID_PUBLIC_KEY!.trim() : null;
}

type PushPayload = {
  title: string;
  body: string;
  url?: string;
  image?: string;
  tag?: string;
  campaignId?: string;
  /** Text is not in the subscriber's language (untranslated broadcast). */
  fallback?: boolean;
};

type TargetSub = { endpoint: string; keys: { p256dh: string; auth: string }; locale?: PushLocale };

function serialize({ fallback, ...payload }: PushPayload, locale: PushLocale) {
  return JSON.stringify({
    ...payload,
    url: payload.url || '/',
    ...(fallback ? { dir: 'auto' } : { lang: locale, dir: locale === 'ar' ? 'rtl' : 'ltr' }),
  });
}

/** Sends one payload per subscriber (localized) and deletes subscriptions the browser revoked. */
async function deliver(
  subscriptions: TargetSub[],
  payloadFor: (locale: PushLocale) => PushPayload,
  options: { urgency?: 'normal' | 'high' } = {}
) {
  let delivered = 0;
  let failed = 0;
  const expired: string[] = [];
  const cache = new Map<PushLocale, string>();
  const bodyFor = (locale: PushLocale) => {
    if (!cache.has(locale)) cache.set(locale, serialize(payloadFor(locale), locale));
    return cache.get(locale)!;
  };

  for (let i = 0; i < subscriptions.length; i += SEND_BATCH_SIZE) {
    const batch = subscriptions.slice(i, i + SEND_BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          bodyFor(sub.locale || 'fr'),
          { TTL: PUSH_TTL_SECONDS, urgency: options.urgency || 'normal' }
        )
      )
    );

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        delivered += 1;
        return;
      }
      failed += 1;
      const status = (result.reason as { statusCode?: number })?.statusCode;
      // 404/410 = the browser unsubscribed or the subscription expired.
      if (status === 404 || status === 410) expired.push(batch[index].endpoint);
    });
  }

  if (expired.length) {
    await PushSubscription.deleteMany({ endpoint: { $in: expired } });
  }

  return { delivered, failed, removed: expired.length };
}

async function resolveOrderOwner(order?: { orderNumber: string; token: string }) {
  if (!order) return undefined;
  const tokenHash = createHash('sha256').update(order.token).digest('hex');
  const found = await Order.findOne({
    orderNumber: order.orderNumber.toUpperCase(),
    receiptTokenHash: tokenHash,
  })
    .select('user')
    .lean();
  return found?.user ? String(found.user) : undefined;
}

export async function saveSubscription(input: {
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
  locale?: PushLocale;
  userId?: string;
  userAgent?: string;
  order?: { orderNumber: string; token: string };
}) {
  const { endpoint, keys } = input.subscription;
  const ownerId = (await resolveOrderOwner(input.order).catch(() => undefined)) || input.userId;
  await PushSubscription.findOneAndUpdate(
    { endpoint },
    {
      $set: {
        keys,
        ...(input.locale ? { locale: input.locale } : {}),
        ...(ownerId ? { user: ownerId } : {}),
        ...(input.userAgent ? { userAgent: input.userAgent.slice(0, 300) } : {}),
      },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
}

export async function removeSubscription(endpoint: string) {
  await PushSubscription.deleteOne({ endpoint });
}

export async function recordClick(campaignId: string) {
  await PushCampaign.updateOne({ _id: campaignId }, { $inc: { clicks: 1 } });
}

export async function getPushOverview(viewerId?: string) {
  const [subscribers, byLocale, campaigns, myDevices] = await Promise.all([
    PushSubscription.estimatedDocumentCount(),
    PushSubscription.aggregate<{ _id: string; count: number }>([
      { $group: { _id: '$locale', count: { $sum: 1 } } },
    ]),
    PushCampaign.find().sort({ createdAt: -1 }).limit(15).lean(),
    viewerId ? PushSubscription.countDocuments({ user: viewerId }) : Promise.resolve(0),
  ]);

  return {
    configured: Boolean(getPushPublicKey()),
    subscribers,
    myDevices,
    byLocale: Object.fromEntries(byLocale.map((row) => [row._id || 'fr', row.count])),
    campaigns,
  };
}

type CampaignInput = {
  title: string;
  body: string;
  url?: string;
  image?: string;
  translations?: Partial<Record<PushLocale, { title?: string; body?: string } | undefined>>;
};

function cleanTranslations(input: CampaignInput['translations']) {
  const out: Partial<Record<PushLocale, { title: string; body: string }>> = {};
  for (const locale of LOCALES) {
    const t = input?.[locale];
    const title = t?.title?.trim();
    const body = t?.body?.trim();
    if (title && body) out[locale] = { title, body };
  }
  return out;
}

function campaignPayload(input: CampaignInput, campaignId?: string) {
  const translations = cleanTranslations(input.translations);
  return (locale: PushLocale): PushPayload => ({
    title: translations[locale]?.title || input.title,
    body: translations[locale]?.body || input.body,
    url: input.url || undefined,
    image: input.image || undefined,
    campaignId,
    fallback: !translations[locale],
  });
}

function requireVapid() {
  if (!ensureVapid()) {
    throw new ApiError(503, 'Push notifications are not configured on the server (VAPID keys missing)');
  }
}

export async function sendPushCampaign(input: CampaignInput, sender: { id: string; name?: string }) {
  requireVapid();

  const subscriptions = await PushSubscription.find().select('endpoint keys locale').lean();
  const campaign = await PushCampaign.create({
    title: input.title,
    body: input.body,
    translations: cleanTranslations(input.translations),
    url: input.url || undefined,
    image: input.image || undefined,
    sentBy: sender.id,
    sentByName: sender.name,
    targeted: subscriptions.length,
  });

  const result = await deliver(subscriptions, campaignPayload(input, String(campaign._id)));
  campaign.delivered = result.delivered;
  campaign.failed = result.failed;
  campaign.removed = result.removed;
  await campaign.save();

  return campaign.toObject();
}

/** Sends the draft only to the sender's own devices so they can check it before a broadcast. */
export async function sendTestPush(input: CampaignInput, userId: string) {
  requireVapid();
  const subscriptions = await PushSubscription.find({ user: userId }).select('endpoint keys locale').lean();
  if (!subscriptions.length) {
    throw new ApiError(400, 'Turn on notifications on this device first (button above), then send a test');
  }
  const result = await deliver(subscriptions, (locale) => ({
    ...campaignPayload(input)(locale),
    title: `[Test] ${campaignPayload(input)(locale).title}`,
  }));
  return { targeted: subscriptions.length, ...result };
}

function formatMad(amount: number) {
  return `${Math.round(amount).toLocaleString('fr-MA')} DH`;
}

/** Phone/desktop alert for staff who can see orders and turned on notifications while signed in. */
export async function notifyStaffNewOrder(order: InstanceType<typeof Order>) {
  if (!ensureVapid()) return;
  const roles = STAFF_ROLES.filter((role) => hasPermission(role, 'orders:read'));
  const staff = await User.find({ role: { $in: roles }, isActive: true }).select('_id').lean();
  if (!staff.length) return;

  const subscriptions = await PushSubscription.find({ user: { $in: staff.map((u) => u._id) } })
    .select('endpoint keys locale')
    .lean();
  if (!subscriptions.length) return;

  const items = order.items.reduce((sum, item) => sum + item.qty, 0);
  await deliver(
    subscriptions,
    () => ({
      title: `New order ${order.orderNumber} — ${formatMad(order.pricing.total)}`,
      body: `${order.shippingAddress.fullName} · ${order.shippingAddress.city} · ${items} item${items === 1 ? '' : 's'}`,
      url: `/admin/orders/${order._id}`,
      tag: `admin-order-${order.orderNumber}`,
    }),
    { urgency: 'high' }
  );
}

const ORDER_STATUS_COPY: Partial<
  Record<OrderStatus, Record<PushLocale, { title: string; body: string }>>
> = {
  confirmed: {
    en: { title: 'Order confirmed', body: 'Your order {n} is confirmed and being prepared.' },
    fr: { title: 'Commande confirmée', body: 'Votre commande {n} est confirmée et en préparation.' },
    ar: { title: 'تم تأكيد الطلب', body: 'طلبك {n} مؤكد وقيد التحضير.' },
  },
  shipped: {
    en: { title: 'Order shipped', body: 'Your order {n} is on the way. Keep your phone nearby — pay cash on delivery.' },
    fr: { title: 'Commande expédiée', body: 'Votre commande {n} est en route. Gardez votre téléphone à portée — paiement à la livraison.' },
    ar: { title: 'تم شحن الطلب', body: 'طلبك {n} في الطريق. أبقِ هاتفك قريبًا — الدفع عند الاستلام.' },
  },
  delivered: {
    en: { title: 'Order delivered', body: 'Your order {n} was delivered. Thank you for shopping with Brynoxa!' },
    fr: { title: 'Commande livrée', body: 'Votre commande {n} a été livrée. Merci pour votre confiance !' },
    ar: { title: 'تم تسليم الطلب', body: 'تم تسليم طلبك {n}. شكرًا لتسوقك من برينوكسا!' },
  },
  cancelled: {
    en: { title: 'Order cancelled', body: 'Your order {n} was cancelled. Contact us on WhatsApp if you need help.' },
    fr: { title: 'Commande annulée', body: 'Votre commande {n} a été annulée. Contactez-nous sur WhatsApp si besoin.' },
    ar: { title: 'تم إلغاء الطلب', body: 'تم إلغاء طلبك {n}. تواصل معنا عبر واتساب إذا احتجت المساعدة.' },
  },
};

/** Tells the customer's subscribed devices about a status change, in each device's language. */
export async function notifyCustomerOrderStatus(
  order: InstanceType<typeof Order>,
  status: OrderStatus,
  options: { isGuest?: boolean } = {}
) {
  const copy = ORDER_STATUS_COPY[status];
  if (!copy || !order.user || !ensureVapid()) return;

  const subscriptions = await PushSubscription.find({ user: order.user })
    .select('endpoint keys locale')
    .lean();
  if (!subscriptions.length) return;

  const url = options.isGuest
    ? '/track-order'
    : `/account/orders/${encodeURIComponent(order.orderNumber)}`;

  await deliver(
    subscriptions,
    (locale) => ({
      title: copy[locale].title,
      body: copy[locale].body.replace('{n}', order.orderNumber),
      url,
      image: order.items[0]?.image?.startsWith('https://') ? order.items[0].image : undefined,
      tag: `order-${order.orderNumber}`,
    }),
    { urgency: 'high' }
  );
}
