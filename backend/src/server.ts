import { env } from './config/env';
import { getApp } from './app';

async function bootstrap() {
  const app = getApp();

  app.listen(Number(env.PORT), () => {
    console.log(`Brynoxa API running on http://localhost:${env.PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
