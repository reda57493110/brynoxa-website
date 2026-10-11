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
        maxIdleTimeMS: 5000,
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
    // Keep Atlas indexes aligned with schema (non-blocking).
    void import('../models/Product')
      .then(({ Product }) => Product.syncIndexes())
      .catch((err) => console.error('Product index sync failed', err));
    void import('../models/Order')
      .then(({ Order }) => Order.syncIndexes())
      .catch((err) => console.error('Order index sync failed', err));
    void import('../models/Review')
      .then(({ Review }) => Review.syncIndexes())
      .catch((err) => console.error('Review index sync failed', err));
    void import('../models/Category')
      .then(({ Category }) => Category.syncIndexes())
      .catch((err) => console.error('Category index sync failed', err));
    void import('../models/Contact')
      .then(({ ContactMessage }) => ContactMessage.syncIndexes())
      .catch((err) => console.error('Contact index sync failed', err));
    return cached.conn;
  } catch (err) {
    cached.promise = null;
    console.error('MongoDB connection failed.');
    throw err;
  }
}
