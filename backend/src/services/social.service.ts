/**
 * Admin → Social media: followers (and posts) of Facebook, Instagram and TikTok typed by staff with
 * "Update my numbers" (one row per platform and day), shown on the account cards with their change
 * over 7 / 30 days and drawn on the growth chart. Messages, posts and full stats are opened in Meta
 * Business Suite / TikTok Studio from the admin page (no connection to the platforms).
 */
import { SOCIAL_PLATFORMS, SocialSnapshot, type SocialPlatform } from '../models/SocialSnapshot';
import { ApiError } from '../utils/ApiError';

/** Today in Morocco */
const today = () => new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);

type Row = { platform: SocialPlatform; day: string; followers: number; posts?: number; manual: boolean };

/** Followers per day for the chart (last `days` days) */
export async function growth(days = 90): Promise<Row[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const rows = await SocialSnapshot.find({ day: { $gte: since } }).sort({ day: 1 }).lean();
  return rows.map((r) => ({ platform: r.platform, day: r.day, followers: r.followers, posts: r.posts, manual: Boolean(r.manual) }));
}

/** "Update my numbers": typing again the same day replaces that day's numbers */
export async function saveNumbers(input: { day: string; entries: { platform: SocialPlatform; followers: number; posts?: number }[] }) {
  if (input.day > today()) throw new ApiError(400, 'Pick today or a past day');
  for (const e of input.entries) {
    await SocialSnapshot.updateOne(
      { platform: e.platform, day: input.day },
      { $set: { followers: Math.round(e.followers), posts: e.posts === undefined ? undefined : Math.round(e.posts), manual: true } },
      { upsert: true }
    );
  }
  return { saved: input.entries.length };
}

export async function deleteNumbers(platform: string, day: string) {
  if (!(SOCIAL_PLATFORMS as readonly string[]).includes(platform) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new ApiError(404, 'Not found');
  await SocialSnapshot.deleteOne({ platform, day, manual: true });
}

/** Everything on the page: each platform's last numbers, the chart, the numbers typed */
export async function overview() {
  const history = await growth(365);
  const platforms = SOCIAL_PLATFORMS.map((platform) => {
    const mine = history.filter((r) => r.platform === platform);
    const last = mine[mine.length - 1];
    return { platform, followers: last?.followers, posts: last?.posts, typedOn: last?.day };
  });
  const since90 = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  return {
    platforms,
    growth: history.filter((r) => r.day >= since90),
    /** Newest first (to correct a mistake) */
    typed: history.filter((r) => r.manual).reverse().slice(0, 30),
  };
}
