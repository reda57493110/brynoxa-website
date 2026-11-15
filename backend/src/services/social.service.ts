/**
 * Admin → Social media: Facebook Page + Instagram business account (Meta) and TikTok, connected by
 * the owner with "Connect" (OAuth). Shows followers (and their growth, from a daily snapshot),
 * latest posts with likes / comments / views, and the Facebook + Instagram inbox with replies.
 *
 * - The owner's own developer apps: META_APP_ID / META_APP_SECRET, TIKTOK_CLIENT_KEY /
 *   TIKTOK_CLIENT_SECRET (Vercel environment). Without them the page shows the setup guide.
 * - Access keys are sealed in the database and never sent to the browser.
 * - The Connect button carries a signed, 10-minute "state" naming the owner who pressed it.
 */
import mongoose from 'mongoose';
import { env } from '../config/env';
import { SocialAccount, SocialSnapshot, type ISocialAccount, type SocialPlatform } from '../models/SocialAccount';
import { User } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { readState, seal, signState, unseal } from '../utils/secretBox';

export const GRAPH_VERSION = process.env.META_GRAPH_VERSION?.trim() || 'v23.0';
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
const TIKTOK_API = 'https://open.tiktokapis.com/v2';

/** Meta permissions asked at Connect: Page + Instagram stats, posts and messages */
export const META_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'read_insights',
  'pages_manage_metadata',
  'pages_messaging',
  'instagram_basic',
  'instagram_manage_insights',
  'instagram_manage_messages',
  'business_management',
];
export const TIKTOK_SCOPES = ['user.info.basic', 'user.info.profile', 'user.info.stats', 'video.list'];

const metaConfigured = () => Boolean(process.env.META_APP_ID?.trim() && process.env.META_APP_SECRET?.trim());
const tiktokConfigured = () => Boolean(process.env.TIKTOK_CLIENT_KEY?.trim() && process.env.TIKTOK_CLIENT_SECRET?.trim());

/** Where Meta / TikTok send the owner back after Connect (to paste in the developer apps) */
export function callbackUrl(platform: 'meta' | 'tiktok') {
  const base = (process.env.SOCIAL_CALLBACK_BASE?.trim() || env.CLIENT_URL).replace(/\/$/, '');
  return `${base}/api/v1/social/${platform}/callback`;
}

/** The admin page the owner lands on after Connect */
const adminPage = (result: string) => `${env.CLIENT_URL.replace(/\/$/, '')}/admin/social?connected=${encodeURIComponent(result)}`;

type Json = Record<string, unknown>;

/** A call to Meta / TikTok; their error message is kept (shown to the owner), never the key */
async function call(url: string, init?: RequestInit): Promise<Json> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(12_000) });
  } catch {
    throw new ApiError(502, 'Could not reach the platform. Try again.');
  }
  const data = (await res.json().catch(() => ({}))) as Json;
  const err = (data.error ?? null) as { message?: string; code?: string | number } | null;
  // TikTok answers { error: { code: 'ok' } } on success
  if (!res.ok || (err && err.code !== 'ok' && err.code !== undefined && err.message)) {
    const msg = String(err?.message || `The platform refused (${res.status})`).replace(/access_token=[^&\s]+/g, 'access_token=…');
    throw new ApiError(502, msg.slice(0, 300));
  }
  return data;
}

const qs = (o: Record<string, string | number | undefined>) =>
  new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined) as [string, string][]).toString();

/* ------------------------------------------------------------------ Connect */

export function connectUrl(platform: 'meta' | 'tiktok', userId: string) {
  const state = signState({ p: platform, u: userId });
  if (platform === 'meta') {
    if (!metaConfigured()) throw new ApiError(400, 'Add META_APP_ID and META_APP_SECRET in Vercel first (see the setup guide)');
    return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${qs({
      client_id: process.env.META_APP_ID!.trim(),
      redirect_uri: callbackUrl('meta'),
      state,
      response_type: 'code',
      scope: META_SCOPES.join(','),
    })}`;
  }
  if (!tiktokConfigured()) throw new ApiError(400, 'Add TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET in Vercel first (see the setup guide)');
  return `https://www.tiktok.com/v2/auth/authorize/?${qs({
    client_key: process.env.TIKTOK_CLIENT_KEY!.trim(),
    scope: TIKTOK_SCOPES.join(','),
    response_type: 'code',
    redirect_uri: callbackUrl('tiktok'),
    state,
  })}`;
}

/** The owner who pressed Connect, if the state is genuine and they are still the owner */
async function ownerFromState(state: unknown, platform: 'meta' | 'tiktok') {
  const s = readState<{ p?: string; u?: string }>(state);
  if (!s || s.p !== platform || !s.u || !mongoose.Types.ObjectId.isValid(s.u)) return null;
  const user = await User.findById(s.u).select('role isActive').lean<{ _id: unknown; role?: string; isActive?: boolean }>();
  return user && user.role === 'admin' && user.isActive !== false ? String(user._id) : null;
}

/** Meta sends the owner back here: keys for the Page and its Instagram account are saved */
export async function metaCallback(query: { code?: unknown; state?: unknown; error?: unknown }) {
  if (query.error || !query.code) return adminPage('meta-cancelled');
  const owner = await ownerFromState(query.state, 'meta');
  if (!owner) return adminPage('expired');
  try {
    const short = await call(`${GRAPH}/oauth/access_token?${qs({
      client_id: process.env.META_APP_ID!.trim(),
      client_secret: process.env.META_APP_SECRET!.trim(),
      redirect_uri: callbackUrl('meta'),
      code: String(query.code),
    })}`);
    // A long-lived user key gives Page keys that do not expire
    const long = await call(`${GRAPH}/oauth/access_token?${qs({
      grant_type: 'fb_exchange_token',
      client_id: process.env.META_APP_ID!.trim(),
      client_secret: process.env.META_APP_SECRET!.trim(),
      fb_exchange_token: String(short.access_token),
    })}`);
    const pages = await call(`${GRAPH}/me/accounts?${qs({
      fields: 'id,name,access_token,link,picture{url},instagram_business_account{id,username,name,profile_picture_url}',
      access_token: String(long.access_token),
    })}`);
    const list = (pages.data as Json[] | undefined) ?? [];
    // The Page with an Instagram account first (the shop's main Page), else the first one
    const page = list.find((p) => p.instagram_business_account) ?? list[0];
    if (!page) return adminPage('meta-no-page');
    const pageToken = String(page.access_token);
    await saveAccount('facebook', {
      externalId: String(page.id),
      name: String(page.name ?? ''),
      picture: ((page.picture as Json)?.data as Json)?.url as string | undefined,
      link: (page.link as string) || `https://www.facebook.com/${page.id}`,
      pageId: String(page.id),
      token: pageToken,
      owner,
    });
    const ig = page.instagram_business_account as Json | undefined;
    if (ig?.id) {
      await saveAccount('instagram', {
        externalId: String(ig.id),
        name: String(ig.name ?? ig.username ?? ''),
        username: ig.username as string | undefined,
        picture: ig.profile_picture_url as string | undefined,
        link: ig.username ? `https://www.instagram.com/${ig.username}` : undefined,
        pageId: String(page.id),
        token: pageToken,
        owner,
      });
    }
    return adminPage(ig?.id ? 'meta' : 'meta-no-instagram');
  } catch (err) {
    console.error('Meta connect failed:', err instanceof Error ? err.message : err);
    return adminPage('meta-failed');
  }
}

/** TikTok sends the owner back here */
export async function tiktokCallback(query: { code?: unknown; state?: unknown; error?: unknown }) {
  if (query.error || !query.code) return adminPage('tiktok-cancelled');
  const owner = await ownerFromState(query.state, 'tiktok');
  if (!owner) return adminPage('expired');
  try {
    const tok = await tiktokToken({ grant_type: 'authorization_code', code: String(query.code), redirect_uri: callbackUrl('tiktok') });
    const info = await tiktokUser(String(tok.access_token));
    await saveAccount('tiktok', {
      externalId: String(tok.open_id ?? info.open_id ?? ''),
      name: String(info.display_name ?? ''),
      username: info.username as string | undefined,
      picture: info.avatar_url as string | undefined,
      link: (info.profile_deep_link as string) || (info.username ? `https://www.tiktok.com/@${info.username}` : undefined),
      token: String(tok.access_token),
      refresh: String(tok.refresh_token ?? ''),
      expiresIn: Number(tok.expires_in) || 86_400,
      refreshExpiresIn: Number(tok.refresh_expires_in) || 365 * 86_400,
      owner,
    });
    return adminPage('tiktok');
  } catch (err) {
    console.error('TikTok connect failed:', err instanceof Error ? err.message : err);
    return adminPage('tiktok-failed');
  }
}

async function saveAccount(
  platform: SocialPlatform,
  a: { externalId: string; name: string; username?: string; picture?: string; link?: string; pageId?: string; token: string; refresh?: string; expiresIn?: number; refreshExpiresIn?: number; owner: string }
) {
  const now = Date.now();
  await SocialAccount.findOneAndUpdate(
    { platform },
    {
      $set: {
        platform,
        externalId: a.externalId,
        name: a.name,
        username: a.username,
        picture: a.picture,
        link: a.link,
        pageId: a.pageId,
        tokenSealed: seal(a.token),
        refreshSealed: a.refresh ? seal(a.refresh) : undefined,
        tokenExpiresAt: a.expiresIn ? new Date(now + a.expiresIn * 1000) : undefined,
        refreshExpiresAt: a.refreshExpiresIn ? new Date(now + a.refreshExpiresIn * 1000) : undefined,
        connectedBy: a.owner,
      },
      $unset: { lastError: '' },
    },
    { upsert: true }
  );
}

export async function disconnect(platform: 'meta' | 'tiktok') {
  const platforms: SocialPlatform[] = platform === 'meta' ? ['facebook', 'instagram'] : ['tiktok'];
  await SocialAccount.deleteMany({ platform: { $in: platforms } });
}

/* ------------------------------------------------------------------ TikTok keys */

async function tiktokToken(body: Record<string, string>) {
  const data = await call(`${TIKTOK_API}/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: qs({ client_key: process.env.TIKTOK_CLIENT_KEY!.trim(), client_secret: process.env.TIKTOK_CLIENT_SECRET!.trim(), ...body }),
  });
  if (!data.access_token) throw new ApiError(502, String(data.error_description || 'TikTok did not give a key'));
  return data;
}

async function tiktokUser(token: string) {
  const data = await call(`${TIKTOK_API}/user/info/?fields=open_id,display_name,avatar_url,username,profile_deep_link,follower_count,following_count,likes_count,video_count`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return ((data.data as Json)?.user ?? {}) as Json;
}

/** TikTok keys last 24 h: renewed with the refresh key (valid a year) */
async function tiktokAccessToken(acc: ISocialAccount) {
  if (acc.tokenExpiresAt && acc.tokenExpiresAt.getTime() > Date.now() + 5 * 60_000) return unseal(acc.tokenSealed);
  if (!acc.refreshSealed) throw new ApiError(401, 'TikTok: connect again');
  const tok = await tiktokToken({ grant_type: 'refresh_token', refresh_token: unseal(acc.refreshSealed) });
  acc.tokenSealed = seal(String(tok.access_token));
  if (tok.refresh_token) acc.refreshSealed = seal(String(tok.refresh_token));
  acc.tokenExpiresAt = new Date(Date.now() + (Number(tok.expires_in) || 86_400) * 1000);
  await acc.save();
  return String(tok.access_token);
}

/* ------------------------------------------------------------------ Stats */

export type SocialPost = {
  id: string;
  text: string;
  image?: string;
  link?: string;
  at: string;
  likes: number;
  comments: number;
  shares?: number;
  views?: number;
};

export type PlatformStats = {
  platform: SocialPlatform;
  connected: boolean;
  name?: string;
  username?: string;
  picture?: string;
  link?: string;
  followers?: number;
  following?: number;
  posts?: number;
  likes?: number;
  reach28?: number;
  recent: SocialPost[];
  error?: string;
};

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);

async function facebookStats(acc: ISocialAccount): Promise<Omit<PlatformStats, 'platform' | 'connected'>> {
  const token = unseal(acc.tokenSealed);
  const [page, posts] = await Promise.all([
    call(`${GRAPH}/${acc.externalId}?${qs({ fields: 'name,followers_count,fan_count,link,picture{url}', access_token: token })}`),
    call(`${GRAPH}/${acc.externalId}/posts?${qs({
      fields: 'id,message,created_time,permalink_url,full_picture,shares,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)',
      limit: 12,
      access_token: token,
    })}`),
  ]);
  let reach28: number | undefined;
  try {
    const ins = await call(`${GRAPH}/${acc.externalId}/insights?${qs({ metric: 'page_impressions_unique', period: 'days_28', access_token: token })}`);
    const values = (((ins.data as Json[])?.[0]?.values as Json[]) ?? []) as Json[];
    reach28 = values.length ? num(values[values.length - 1].value) : undefined;
  } catch {
    /* insights are optional (Meta changes them often) */
  }
  return {
    name: String(page.name ?? acc.name),
    picture: ((page.picture as Json)?.data as Json)?.url as string | undefined,
    link: (page.link as string) || acc.link,
    followers: num(page.followers_count ?? page.fan_count),
    reach28,
    recent: ((posts.data as Json[]) ?? []).map((p) => ({
      id: String(p.id),
      text: String(p.message ?? ''),
      image: p.full_picture as string | undefined,
      link: p.permalink_url as string | undefined,
      at: String(p.created_time ?? ''),
      likes: num(((p.reactions as Json)?.summary as Json)?.total_count),
      comments: num(((p.comments as Json)?.summary as Json)?.total_count),
      shares: num((p.shares as Json)?.count),
    })),
  };
}

async function instagramStats(acc: ISocialAccount): Promise<Omit<PlatformStats, 'platform' | 'connected'>> {
  const token = unseal(acc.tokenSealed);
  const [user, media] = await Promise.all([
    call(`${GRAPH}/${acc.externalId}?${qs({ fields: 'username,name,followers_count,follows_count,media_count,profile_picture_url', access_token: token })}`),
    call(`${GRAPH}/${acc.externalId}/media?${qs({
      fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
      limit: 12,
      access_token: token,
    })}`),
  ]);
  let reach28: number | undefined;
  try {
    const until = Math.floor(Date.now() / 1000);
    const ins = await call(`${GRAPH}/${acc.externalId}/insights?${qs({ metric: 'reach', period: 'day', metric_type: 'total_value', since: until - 28 * 86_400, until, access_token: token })}`);
    const v = (((ins.data as Json[])?.[0]?.total_value as Json)?.value);
    reach28 = v === undefined ? undefined : num(v);
  } catch {
    /* optional */
  }
  return {
    name: String(user.name ?? user.username ?? acc.name),
    username: user.username as string | undefined,
    picture: user.profile_picture_url as string | undefined,
    link: user.username ? `https://www.instagram.com/${user.username}` : acc.link,
    followers: num(user.followers_count),
    following: num(user.follows_count),
    posts: num(user.media_count),
    reach28,
    recent: ((media.data as Json[]) ?? []).map((m) => ({
      id: String(m.id),
      text: String(m.caption ?? ''),
      image: (m.media_type === 'VIDEO' ? m.thumbnail_url : m.media_url) as string | undefined,
      link: m.permalink as string | undefined,
      at: String(m.timestamp ?? ''),
      likes: num(m.like_count),
      comments: num(m.comments_count),
    })),
  };
}

async function tiktokStats(acc: ISocialAccount): Promise<Omit<PlatformStats, 'platform' | 'connected'>> {
  const token = await tiktokAccessToken(acc);
  const [user, videos] = await Promise.all([
    tiktokUser(token),
    call(`${TIKTOK_API}/video/list/?fields=id,title,video_description,cover_image_url,share_url,create_time,view_count,like_count,comment_count,share_count`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ max_count: 12 }),
    }),
  ]);
  return {
    name: String(user.display_name ?? acc.name),
    username: user.username as string | undefined,
    picture: user.avatar_url as string | undefined,
    link: (user.profile_deep_link as string) || acc.link,
    followers: num(user.follower_count),
    following: num(user.following_count),
    posts: num(user.video_count),
    likes: num(user.likes_count),
    recent: ((((videos.data as Json)?.videos as Json[]) ?? []) as Json[]).map((v) => ({
      id: String(v.id),
      text: String(v.title || v.video_description || ''),
      image: v.cover_image_url as string | undefined,
      link: v.share_url as string | undefined,
      at: v.create_time ? new Date(num(v.create_time) * 1000).toISOString() : '',
      likes: num(v.like_count),
      comments: num(v.comment_count),
      shares: num(v.share_count),
      views: num(v.view_count),
    })),
  };
}

const STATS = { facebook: facebookStats, instagram: instagramStats, tiktok: tiktokStats } as const;

/** Today in Morocco (snapshots are one per day) */
const today = () => new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);

async function snapshot(platform: SocialPlatform, followers: number, posts?: number) {
  try {
    await SocialSnapshot.updateOne({ platform, day: today() }, { $set: { followers, posts } }, { upsert: true });
  } catch {
    /* the chart misses a day, nothing else */
  }
}

/** Followers per day for the chart (last `days` days) */
export async function growth(days = 90) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const rows = await SocialSnapshot.find({ day: { $gte: since } }).sort({ day: 1 }).lean();
  return rows.map((r) => ({ platform: r.platform, day: r.day, followers: r.followers }));
}

/** Everything on the page: setup state, each platform's numbers and posts, growth */
export async function overview() {
  const accounts = await SocialAccount.find().lean<ISocialAccount[]>();
  const byPlatform = new Map(accounts.map((a) => [a.platform, a]));
  const platforms = await Promise.all(
    (['facebook', 'instagram', 'tiktok'] as SocialPlatform[]).map(async (platform): Promise<PlatformStats> => {
      const acc = byPlatform.get(platform);
      if (!acc) return { platform, connected: false, recent: [] };
      try {
        // TikTok may renew its key: work on a real document
        const doc = platform === 'tiktok' ? await SocialAccount.findById(acc._id) : (acc as ISocialAccount);
        const stats = await STATS[platform](doc!);
        if (typeof stats.followers === 'number') await snapshot(platform, stats.followers, stats.posts);
        if (acc.lastError) await SocialAccount.updateOne({ _id: acc._id }, { $unset: { lastError: '' } });
        return { platform, connected: true, ...stats };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not read this account';
        await SocialAccount.updateOne({ _id: acc._id }, { $set: { lastError: message } }).catch(() => undefined);
        return { platform, connected: true, name: acc.name, username: acc.username, picture: acc.picture, link: acc.link, recent: [], error: message };
      }
    })
  );
  return {
    setup: {
      meta: { configured: metaConfigured(), callbackUrl: callbackUrl('meta'), graphVersion: GRAPH_VERSION },
      tiktok: { configured: tiktokConfigured(), callbackUrl: callbackUrl('tiktok') },
    },
    platforms,
    growth: await growth(90),
  };
}

/* ------------------------------------------------------------------ Messages (Facebook + Instagram) */

async function pageAccount() {
  const acc = await SocialAccount.findOne({ platform: 'facebook' });
  if (!acc) throw new ApiError(400, 'Connect Facebook first');
  return { pageId: acc.pageId || acc.externalId, token: unseal(acc.tokenSealed) };
}

export async function conversations(platform: 'facebook' | 'instagram') {
  const { pageId, token } = await pageAccount();
  const data = await call(`${GRAPH}/${pageId}/conversations?${qs({
    platform: platform === 'instagram' ? 'instagram' : 'messenger',
    fields: 'id,updated_time,unread_count,participants,messages.limit(1){message,from,created_time}',
    limit: 25,
    access_token: token,
  })}`);
  return ((data.data as Json[]) ?? []).map((c) => {
    const people = (((c.participants as Json)?.data as Json[]) ?? []) as Json[];
    const customer = people.find((p) => String(p.id) !== pageId) ?? people[0] ?? {};
    const last = ((((c.messages as Json)?.data as Json[]) ?? [])[0] ?? {}) as Json;
    return {
      id: String(c.id),
      name: String(customer.name ?? customer.username ?? 'Customer'),
      customerId: String(customer.id ?? ''),
      updatedAt: String(c.updated_time ?? ''),
      unread: num(c.unread_count),
      last: String(last.message ?? ''),
      lastFromShop: String((last.from as Json)?.id ?? '') === pageId,
    };
  });
}

export async function thread(conversationId: string) {
  if (!/^[\w.:-]{1,200}$/.test(conversationId)) throw new ApiError(400, 'Unknown conversation');
  const { pageId, token } = await pageAccount();
  const data = await call(`${GRAPH}/${conversationId}?${qs({ fields: 'messages.limit(40){message,from,created_time}', access_token: token })}`);
  const msgs = (((data.messages as Json)?.data as Json[]) ?? []) as Json[];
  return msgs
    .map((m) => ({
      id: String(m.id),
      text: String(m.message ?? ''),
      at: String(m.created_time ?? ''),
      fromShop: String((m.from as Json)?.id ?? '') === pageId,
      from: String((m.from as Json)?.name ?? (m.from as Json)?.username ?? ''),
    }))
    .reverse();
}

/**
 * Replies from the Page (Facebook) or its Instagram account. Meta only allows it within 24 hours
 * of the customer's last message.
 */
export async function reply(input: { customerId: string; text: string }) {
  const text = String(input.text ?? '').trim().slice(0, 1000);
  if (!text) throw new ApiError(400, 'Write a message');
  if (!/^\d{5,30}$/.test(String(input.customerId))) throw new ApiError(400, 'Unknown customer');
  const { pageId, token } = await pageAccount();
  await call(`${GRAPH}/${pageId}/messages?${qs({ access_token: token })}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { id: input.customerId }, message: { text }, messaging_type: 'RESPONSE' }),
  });
  return { sent: true };
}
