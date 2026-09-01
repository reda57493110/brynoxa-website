import type { VercelRequest, VercelResponse } from '@vercel/node';
import serverless from 'serverless-http';
import { getApp } from '../backend/src/app';

type ServerlessHandler = ReturnType<typeof serverless>;

let handler: ServerlessHandler | null = null;

export default async function vercelHandler(req: VercelRequest, res: VercelResponse) {
  if (!handler) {
    const app = await getApp();
    handler = serverless(app);
  }
  return handler(req, res);
}
