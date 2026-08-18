import mongoose from 'mongoose';
import { env } from './env';

function isMemoryUri(uri: string): boolean {
  return uri === 'memory' || process.env.USE_MEMORY_DB === 'true';
}

export async function connectDB(): Promise<void> {
  let uri = env.MONGODB_URI;

  if (isMemoryUri(uri)) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create();
    uri = mongod.getUri('brynoxa');
    console.log('Using in-memory MongoDB');
  }

  try {
    await mongoose.connect(uri);
    const host = mongoose.connection.host || 'unknown';
    console.log(`MongoDB connected (${isMemoryUri(env.MONGODB_URI) ? 'in-memory' : host})`);
  } catch (err) {
    if (isMemoryUri(env.MONGODB_URI)) {
      throw err;
    }
    console.error('MongoDB Atlas/local connection failed. In-memory fallback is disabled.');
    throw err;
  }
}
