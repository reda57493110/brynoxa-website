import { createHash } from 'crypto';
import mongoose from 'mongoose';
import { env } from './env';
import { attachDatabasePool } from '@vercel/functions';

declare global {
  // eslint-disable-next-line no-var
  var __mongooseCache:
    | {
        conn: typeof mongoose | null;
        promise: Promise<typeof mongoose> | null;
      }
    | undefined;
}

const cached = global.__mongooseCache ?? { conn: null, promise: null };
global.__mongooseCache = cached;

/** Runs syncIndexes for these models when their declared indexes differ from the last sync. */
async function syncIndexesWhenChanged() {
  const [{ Product }, { Order }, { Review }, { Category }, { ContactMessage }, { User }] = await Promise.all([
    import('../models/Product'),
    import('../models/Order'),
    import('../models/Review'),
    import('../models/Category'),
    import('../models/Contact'),
    import('../models/User'),
  ]);
  const models = [Product, Order, Review, Category, ContactMessage, User] as unknown as {
    modelName: string;
    schema: { indexes: () => unknown };
    syncIndexes: () => Promise<unknown>;
  }[];
  const signature = createHash('sha256')
    .update(JSON.stringify(models.map((m) => [m.modelName, m.schema.indexes()])))
    .digest('hex');
  const meta = mongoose.connection.db!.collection<{ _id: string; signature: string; at: Date }>('app_meta');
  const last = await meta.findOne({ _id: 'indexes' });
  if (last?.signature === signature) return;
  for (const m of models) {
    await m.syncIndexes().catch((err) => console.error(`${m.modelName} index sync failed`, err));
  }
  await meta.updateOne({ _id: 'indexes' }, { $set: { signature, at: new Date() } }, { upsert: true });
}

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(env.MONGODB_URI, {
        serverSelectionTimeoutMS: 30000,
        connectTimeoutMS: 30000,
        socketTimeoutMS: 45000,
        // Serverless: many function instances each hold their own pool, and the free Atlas tier
        // allows 500 connections in total. Keep each pool small and close idle sockets quickly.
        maxPoolSize: 3,
        minPoolSize: 0,
        // 20 s: a few requests in a row reuse the connection instead of reconnecting each time
        maxIdleTimeMS: 20000,
      })
      .then((connection) => {
      // On Vercel, keep the instance alive long enough to close idle connections before it
      // is frozen (frozen instances otherwise keep their sockets open on Atlas).
      if (process.env.VERCEL) {
        try {
          attachDatabasePool(connection.connection.getClient());
        } catch (err) {
          console.error('attachDatabasePool failed', err);
        }
      }
      const host = connection.connection.host || 'unknown';
      console.log(`MongoDB connected (${host})`);
      return connection;
    });
  }

  try {
    cached.conn = await cached.promise;
    // Keep Atlas indexes aligned with the schemas, in the background — only when the index list
    // changed since the last sync (not on every cold start, where it competed with real queries)
    void syncIndexesWhenChanged().catch((err) => console.error('Index sync failed', err));
    return cached.conn;
  } catch (err) {
    cached.promise = null;
    console.error('MongoDB connection failed.');
    throw err;
  }
}
