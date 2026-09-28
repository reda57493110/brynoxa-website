import webpush from 'web-push';
import { env } from '../config/env';
import { PushCampaign, PushSubscription } from '../models/PushSubscription';
import { ApiError } from '../utils/ApiError';

const DEFAULT_SUBJECT = 'mailto:reda.lazrak2004@gmail.com';
const SEND_BATCH_SIZE = 100;
const PUSH_TTL_SECONDS = 24 * 60 * 60;

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

export async function saveSubscription(input: {
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
  locale?: 'en' | 'fr' | 'ar';
  userId?: string;
  userAgent?: string;
}) {
  const { endpoint, keys } = input.subscription;
  await PushSubscription.findOneAndUpdate(
    { endpoint },
    {
      $set: {
        keys,
        ...(input.locale ? { locale: input.locale } : {}),
        ...(input.userId ? { user: input.userId } : {}),
        ...(input.userAgent ? { userAgent: input.userAgent.slice(0, 300) } : {}),
      },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
}

export async function removeSubscription(endpoint: string) {
  await PushSubscription.deleteOne({ endpoint });
}

export async function getPushOverview() {
  const [subscribers, byLocale, campaigns] = await Promise.all([
    PushSubscription.estimatedDocumentCount(),
    PushSubscription.aggregate<{ _id: string; count: number }>([
      { $group: { _id: '$locale', count: { $sum: 1 } } },
    ]),
    PushCampaign.find().sort({ createdAt: -1 }).limit(15).lean(),
  ]);

  return {
    configured: Boolean(getPushPublicKey()),
    subscribers,
    byLocale: Object.fromEntries(byLocale.map((row) => [row._id || 'fr', row.count])),
    campaigns,
  };
}

export async function sendPushCampaign(
  input: { title: string; body: string; url?: string; image?: string },
  sender: { id: string; name?: string }
) {
  if (!ensureVapid()) {
    throw new ApiError(503, 'Push notifications are not configured on the server (VAPID keys missing)');
  }

  const payload = JSON.stringify({
    title: input.title,
    body: input.body,
    url: input.url || '/',
    image: input.image || undefined,
  });

  const subscriptions = await PushSubscription.find().select('endpoint keys').lean();
  let delivered = 0;
  let failed = 0;
  const expired: string[] = [];

  for (let i = 0; i < subscriptions.length; i += SEND_BATCH_SIZE) {
    const batch = subscriptions.slice(i, i + SEND_BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          payload,
          { TTL: PUSH_TTL_SECONDS, urgency: 'normal' }
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

  const campaign = await PushCampaign.create({
    title: input.title,
    body: input.body,
    url: input.url || undefined,
    image: input.image || undefined,
    sentBy: sender.id,
    sentByName: sender.name,
    targeted: subscriptions.length,
    delivered,
    failed,
    removed: expired.length,
  });

  return campaign.toObject();
}
