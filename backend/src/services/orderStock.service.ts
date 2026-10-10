import type { ClientSession } from 'mongoose';
import type { Order } from '../models/Order';
import { Product } from '../models/Product';
import { InventoryUnit } from '../models/Inventory';
import { moveStock, withTransaction } from './inventoryLedger.service';

type OrderDoc = InstanceType<typeof Order>;

/**
 * Order ↔ inventory. Confirm: available → reserved (all lines in one transaction, so a multi-line
 * order never half-reserves). Ship: reserved → out of the store. Cancel before shipping: reserved →
 * available. Every step has an idempotency key per order line, so repeats are ignored.
 */

async function pickSerials(productId: unknown, qty: number, session?: ClientSession) {
  const units = await InventoryUnit.find({ product: productId, status: 'available' })
    .sort({ createdAt: 1 })
    .limit(qty)
    .select('serial')
    .session(session ?? null)
    .lean();
  // Only assign serials when every unit of the line can be identified
  return units.length === qty ? units.map((u) => u.serial) : undefined;
}

export async function reserveOrderStock(order: OrderDoc, by?: string) {
  await withTransaction(async (session) => {
    for (const item of order.items) {
      const product = await Product.findById(item.product).select('serialTracking').session(session ?? null).lean();
      const serials = product?.serialTracking ? await pickSerials(item.product, item.qty, session) : undefined;
      const res = await moveStock(
        {
          product: item.product,
          qty: item.qty,
          from: 'available',
          to: 'reserved',
          type: 'order-reservation',
          reason: `Order #${order.orderNumber} confirmed`,
          serials,
          order: order._id,
          orderNumber: order.orderNumber,
          by,
          idempotencyKey: `order:${order._id}:reserve:${item.product}`,
        },
        session
      );
      if (!res.duplicate) {
        await Product.updateOne({ _id: item.product }, { $inc: { soldCount: item.qty } }, { session });
        if (serials) item.serials = serials;
      }
    }
  });
  order.markModified('items');
  order.inventoryLedger = true;
}

export async function releaseOrderStock(order: OrderDoc, reason: string, by?: string) {
  if (order.stockDispatched) return; // goods already left the store
  await withTransaction(async (session) => {
    for (const item of order.items) {
      let res;
      if (order.inventoryLedger) {
        res = await moveStock(
          {
            product: item.product,
            qty: item.qty,
            from: 'reserved',
            to: 'available',
            type: 'reservation-release',
            reason: `Order #${order.orderNumber}: ${reason}`,
            serials: item.serials?.length === item.qty ? item.serials : undefined,
            order: order._id,
            orderNumber: order.orderNumber,
            by,
            idempotencyKey: `order:${order._id}:release:${item.product}`,
          },
          session
        );
      } else {
        // Confirmed before the ledger existed: stock was taken directly, so put it back the same way
        const product = await Product.findById(item.product).select('+costPrice').session(session ?? null).lean();
        res = await moveStock(
          {
            product: item.product,
            qty: item.qty,
            from: 'external',
            to: 'available',
            type: 'reservation-release',
            reason: `Order #${order.orderNumber}: ${reason}`,
            unitCost: typeof product?.costPrice === 'number' ? product.costPrice : undefined,
            order: order._id,
            orderNumber: order.orderNumber,
            by,
            idempotencyKey: `order:${order._id}:release:${item.product}`,
          },
          session
        );
      }
      if (!res.duplicate) {
        await Product.updateOne({ _id: item.product, soldCount: { $gte: item.qty } }, { $inc: { soldCount: -item.qty } }, { session });
      }
    }
  });
}

export async function dispatchOrderStock(order: OrderDoc, by?: string) {
  if (order.stockDispatched) return;
  if (order.inventoryLedger) {
    await withTransaction(async (session) => {
      for (const item of order.items) {
        await moveStock(
          {
            product: item.product,
            qty: item.qty,
            from: 'reserved',
            to: 'external',
            type: 'order-dispatch',
            reason: `Order #${order.orderNumber} shipped`,
            serials: item.serials?.length === item.qty ? item.serials : undefined,
            order: order._id,
            orderNumber: order.orderNumber,
            by,
            idempotencyKey: `order:${order._id}:dispatch:${item.product}`,
          },
          session
        );
      }
    });
  }
  order.stockDispatched = true;
}
