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
import { runBootstrap } from './bootstrap';

let app: express.Application | null = null;
let initPromise: Promise<void> | null = null;

function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await connectDB();
      await runBootstrap();
    })();
  }
  return initPromise;
}

export function getApp(): express.Application {
  if (app) return app;

  const expressApp = express();

  expressApp.set('trust proxy', 1);
  expressApp.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  expressApp.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    })
  );
  expressApp.use(compression());
  expressApp.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));
  expressApp.use(express.json({ limit: '2mb' }));
  expressApp.use(express.urlencoded({ extended: true }));
  expressApp.use(cookieParser());

  expressApp.get('/api/v1/health', (_req, res) => {
    res.json({ success: true, message: 'Brynoxa API OK' });
  });

  expressApp.use(async (req, res, next) => {
    try {
      await ensureInitialized();
      next();
    } catch (err) {
      next(err);
    }
  });

  expressApp.use('/api/v1', routes);

  expressApp.use(notFound);
  expressApp.use(errorHandler);

  app = expressApp;
  return app;
}
