import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env';
import { connectDB } from './config/db';
import routes from './routes';
import { errorHandler, notFound } from './middleware/errorHandler';
import { runSeed, removeRetiredCategories, ensureAdmin } from './seed/seed';
import { migrateCurrencyToMad } from './config/migrateCurrency';

async function bootstrap() {
  await connectDB();
  await migrateCurrencyToMad();
  await removeRetiredCategories();
  await ensureAdmin();

  if (env.MONGODB_URI === 'memory' || process.env.USE_MEMORY_DB === 'true') {
    await runSeed(false);
  }

  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true,
    })
  );
  app.use(compression());
  app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.use('/api/v1', routes);

  app.use(notFound);
  app.use(errorHandler);

  app.listen(Number(env.PORT), () => {
    console.log(`Brynoxa API running on http://localhost:${env.PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
