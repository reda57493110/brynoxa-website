import { Product } from '../models/Product';
import { Coupon } from '../models/Coupon';
import { Order } from '../models/Order';
import { getSettings } from '../models/Settings';

const USD_TO_MAD = 10;

export async function migrateCurrencyToMad(): Promise<void> {
  const settings = await getSettings();
  if (settings.currency === 'MAD') return;

  await Product.updateMany({}, [
    {
      $set: {
        price: { $round: [{ $multiply: ['$price', USD_TO_MAD] }, 2] },
        compareAtPrice: {
          $cond: [
            { $gt: [{ $ifNull: ['$compareAtPrice', 0] }, 0] },
            { $round: [{ $multiply: ['$compareAtPrice', USD_TO_MAD] }, 2] },
            '$compareAtPrice',
          ],
        },
      },
    },
  ]);

  await Coupon.updateMany({}, [
    {
      $set: {
        minOrder: { $round: [{ $multiply: ['$minOrder', USD_TO_MAD] }, 2] },
        value: {
          $cond: [
            { $eq: ['$type', 'fixed'] },
            { $round: [{ $multiply: ['$value', USD_TO_MAD] }, 2] },
            '$value',
          ],
        },
      },
    },
  ]);

  await Order.updateMany({}, [
    {
      $set: {
        'pricing.subtotal': { $multiply: ['$pricing.subtotal', USD_TO_MAD] },
        'pricing.discount': { $multiply: ['$pricing.discount', USD_TO_MAD] },
        'pricing.shipping': { $multiply: ['$pricing.shipping', USD_TO_MAD] },
        'pricing.tax': { $multiply: ['$pricing.tax', USD_TO_MAD] },
        'pricing.total': { $multiply: ['$pricing.total', USD_TO_MAD] },
        items: {
          $map: {
            input: '$items',
            as: 'item',
            in: {
              $mergeObjects: [
                '$$item',
                { price: { $multiply: ['$$item.price', USD_TO_MAD] } },
              ],
            },
          },
        },
      },
    },
  ]);

  settings.currency = 'MAD';
  settings.shippingFlatRate *= USD_TO_MAD;
  settings.freeShippingMin *= USD_TO_MAD;
  await settings.save();
  console.log('Store currency migrated to MAD (DH)');
}
