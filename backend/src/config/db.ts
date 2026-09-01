import mongoose from 'mongoose';
import { env } from './env';

function isMemoryUri(uri: string): boolean {
  return uri === 'memory' || process.env.USE_MEMORY_DB === 'true';
}

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

  let uri = env.MONGODB_URI;

  if (isMemoryUri(uri)) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create();
    uri = mongod.getUri('brynoxa');
    console.log('Using in-memory MongoDB');
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri).then((connection) => {
      const host = connection.connection.host || 'unknown';
      console.log(`MongoDB connected (${isMemoryUri(env.MONGODB_URI) ? 'in-memory' : host})`);
      return connection;
    });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (err) {
    cached.promise = null;
    if (isMemoryUri(env.MONGODB_URI)) {
      throw err;
    }
    console.error('MongoDB Atlas/local connection failed. In-memory fallback is disabled.');
    throw err;
  }
}
