import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError';
import { User } from '../models/User';
import { Product } from '../models/Product';
import { Order } from '../models/Order';
import { Settings, clearSettingsCache } from '../models/Settings';
import { Coupon } from '../models/Coupon';
import { Wishlist } from '../models/Wishlist';
import { Review } from '../models/Review';
import { Notification } from '../models/Notification';
import { SentEmail } from '../models/SentEmail';
import { DepositProof } from '../models/DepositProof';
import { DepositReceipt } from '../models/DepositReceipt';
import { BlockedPhone } from '../models/BlockedPhone';
import { PushCampaign, PushSubscription } from '../models/PushSubscription';
import { StockMovement, InventoryUnit, SupplierReceipt, CustomerReturn, RepairRecord } from '../models/Inventory';
import { Expense } from '../models/Expense';
import { AdCampaign } from '../models/AdCampaign';
import { SocialSnapshot } from '../models/SocialSnapshot';
import { ContactMessage, NewsletterSubscriber } from '../models/Contact';
import { StaffAction } from '../models/StaffAction';
import { STAFF_ROLES } from '../permissions';
import { deleteUnusedImages } from './upload.service';

/**
 * Admin → Security → "Empty the test data" (owner only): before the shop opens, removes the test
 * products, orders, customers… in groups the owner ticks. Never touched: settings and design,
 * staff accounts, categories, brands, coupons (only their use count goes back to 0), shipping /
 * deposit / tracking settings. Needs the owner's password and the word EMPTY; logged in Team
 * history. A backup should be made first (GitHub → Actions → Database backup).
 */

export const RESET_GROUPS = ['catalog', 'inventory', 'orders', 'customers', 'money', 'marketing', 'messages', 'history'] as const;
export type ResetGroup = (typeof RESET_GROUPS)[number];
export const RESET_WORD = 'EMPTY';

/** Groups that must go together (orders point to customers, stock to products) */
export function withRequiredGroups(groups: ResetGroup[]): ResetGroup[] {
  const set = new Set(groups.filter((g) => (RESET_GROUPS as readonly string[]).includes(g)));
  if (set.has('catalog')) set.add('inventory');
  if (set.has('customers')) set.add('orders');
  return RESET_GROUPS.filter((g) => set.has(g));
}

const notStaff = { role: { $nin: [...STAFF_ROLES] } };

/** What each group holds now (shown before anything is deleted) */
export async function resetPreview() {
  const staffIds = (await User.find({ role: { $in: [...STAFF_ROLES] } }).select('_id').lean()).map((u) => u._id);
  const [products, wishlists, reviews, movements, units, receipts, returns, repairs, orders, proofs, receiptsDep, notifications, emails, customers, blocked, pushSubs, expenses, campaigns, pushCampaigns, social, newsletter, messages, history] =
    await Promise.all([
      Product.countDocuments({}),
      Wishlist.countDocuments({}),
      Review.countDocuments({}),
      StockMovement.countDocuments({}),
      InventoryUnit.countDocuments({}),
      SupplierReceipt.countDocuments({}),
      CustomerReturn.countDocuments({}),
      RepairRecord.countDocuments({}),
      Order.countDocuments({}),
      DepositProof.countDocuments({}),
      DepositReceipt.countDocuments({}),
      Notification.countDocuments({}),
      SentEmail.countDocuments({}),
      User.countDocuments(notStaff),
      BlockedPhone.countDocuments({}),
      PushSubscription.countDocuments({ user: { $nin: staffIds } }),
      Expense.countDocuments({}),
      AdCampaign.countDocuments({}),
      PushCampaign.countDocuments({}),
      SocialSnapshot.countDocuments({}),
      NewsletterSubscriber.countDocuments({}),
      ContactMessage.countDocuments({}),
      StaffAction.countDocuments({}),
    ]);
  return {
    word: RESET_WORD,
    groups: {
      catalog: { products, wishlists, reviews },
      inventory: { movements, units, receipts, returns, repairs },
      orders: { orders, deposits: proofs + receiptsDep, notifications, emails },
      customers: { customers, blocked, pushSubscriptions: pushSubs },
      money: { expenses, campaigns },
      marketing: { pushCampaigns, social, newsletter },
      messages: { messages },
      history: { history },
    } satisfies Record<ResetGroup, Record<string, number>>,
  };
}

/**
 * Deletes the chosen groups. `ownerId` must be the owner (role admin) and `password` theirs;
 * `confirm` must be the word EMPTY. Returns how many items each group removed.
 */
export async function resetTestData(input: { ownerId: string; password: string; confirm: string; groups: string[] }) {
  if (!mongoose.isValidObjectId(input.ownerId)) throw new ApiError(403, 'Only the owner can empty the test data');
  const owner = await User.findById(input.ownerId).select('+password role isActive');
  if (!owner || owner.role !== 'admin' || !owner.isActive) throw new ApiError(403, 'Only the owner can empty the test data');
  if (String(input.confirm || '').trim() !== RESET_WORD) throw new ApiError(400, `Type ${RESET_WORD} to confirm`);
  if (!input.password || !(await owner.comparePassword(input.password))) throw new ApiError(401, 'Wrong password');
  const groups = withRequiredGroups((Array.isArray(input.groups) ? input.groups : []) as ResetGroup[]);
  if (!groups.length) throw new ApiError(400, 'Choose what to empty');

  const removed: Record<string, number> = {};
  const count = (key: string, r: { deletedCount?: number }) => {
    removed[key] = (removed[key] || 0) + (r.deletedCount || 0);
  };
  const staffIds = (await User.find({ role: { $in: [...STAFF_ROLES] } }).select('_id').lean()).map((u) => u._id);

  if (groups.includes('catalog')) {
    // Photos first noted, products removed, then photos nothing else uses (categories, brands keep theirs)
    const images = (await Product.find({}).select('images').lean()).flatMap((p) => p.images || []);
    count('products', await Product.deleteMany({}));
    count('wishlists', await Wishlist.deleteMany({}));
    count('reviews', await Review.deleteMany({}));
    await deleteUnusedImages(images);
    // Home page and shop choices pointed to these products: back to suggestions / automatic
    await Settings.updateMany({}, { $set: { homeDeals: [], homeRows: {}, categoryHeroes: {}, 'pageHeroProducts.home': '', 'pageHeroProducts.shop': '' } });
    clearSettingsCache();
  }
  if (groups.includes('inventory')) {
    count('movements', await StockMovement.deleteMany({}));
    count('units', await InventoryUnit.deleteMany({}));
    count('receipts', await SupplierReceipt.deleteMany({}));
    count('returns', await CustomerReturn.deleteMany({}));
    count('repairs', await RepairRecord.deleteMany({}));
    // Products kept: their stock follows the emptied ledger
    if (!groups.includes('catalog')) await Product.updateMany({}, { $set: { stock: 0 } });
  }
  if (groups.includes('orders')) {
    count('orders', await Order.deleteMany({}));
    count('deposits', await DepositProof.deleteMany({}));
    count('deposits', await DepositReceipt.deleteMany({}));
    count('notifications', await Notification.deleteMany({}));
    count('emails', await SentEmail.deleteMany({}));
    // Coupons stay; their use starts again from 0
    await Coupon.updateMany({}, { $set: { usedCount: 0 } });
  }
  if (groups.includes('customers')) {
    count('customers', await User.deleteMany(notStaff));
    count('blocked', await BlockedPhone.deleteMany({}));
    count('pushSubscriptions', await PushSubscription.deleteMany({ user: { $nin: staffIds } }));
    if (!groups.includes('catalog')) count('wishlists', await Wishlist.deleteMany({}));
  }
  if (groups.includes('money')) {
    count('expenses', await Expense.deleteMany({}));
    count('campaigns', await AdCampaign.deleteMany({}));
  }
  if (groups.includes('marketing')) {
    count('pushCampaigns', await PushCampaign.deleteMany({}));
    count('social', await SocialSnapshot.deleteMany({}));
    count('newsletter', await NewsletterSubscriber.deleteMany({}));
  }
  if (groups.includes('messages')) {
    count('messages', await ContactMessage.deleteMany({}));
  }
  if (groups.includes('history')) {
    count('history', await StaffAction.deleteMany({}));
  }

  // Always written last, so the history (even emptied) shows who started fresh and when
  await StaffAction.create({
    user: owner._id,
    role: 'admin',
    action: `Emptied the test data (${groups.join(', ')})`,
    kind: 'settings',
    method: 'POST',
    path: 'admin/reset-data',
    at: new Date(),
  });

  return { groups, removed };
}
