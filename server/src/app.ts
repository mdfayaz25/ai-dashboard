import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env, isProd } from './config/env.js';
import { errorHandler, notFound } from './middleware/error.js';
import { apiRouter } from './routes/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: isProd ? undefined : false }));
  app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  if (env.NODE_ENV === 'development') app.use(morgan('dev'));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));
  app.use('/api', apiRouter);

  // In production the API also serves the built React app.
  if (isProd) {
    const clientDist = path.resolve(__dirname, '../../client/dist');
    app.use(express.static(clientDist));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use('/api', notFound);
  app.use(errorHandler);
  return app;
}
