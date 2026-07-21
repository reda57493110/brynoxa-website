import mongoose from 'mongoose';
import { env } from './env';

export async function connectDB(): Promise<void> {
  let uri = env.MONGODB_URI;

  if (uri === 'memory' || process.env.USE_MEMORY_DB === 'true') {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create();
    uri = mongod.getUri('brynoxa');
    console.log('Using in-memory MongoDB');
  }

  try {
    await mongoose.connect(uri);
    console.log('MongoDB connected');
  } catch (err) {
    console.warn('MongoDB connection failed, falling back to in-memory database...', err);
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri('brynoxa'));
    console.log('In-memory MongoDB connected (data will not persist)');
  }
}
