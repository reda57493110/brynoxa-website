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

let appPromise: Promise<express.Application> | null = null;

export async function getApp(): Promise<express.Application> {
  if (appPromise) return appPromise;

  appPromise = (async () => {
    await connectDB();
    await runBootstrap();

    const app = express();

    app.set('trust proxy', 1);
    app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
    app.use(
      cors({
        origin: env.CLIENT_URL,
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
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

    return app;
  })();

  return appPromise;
}
