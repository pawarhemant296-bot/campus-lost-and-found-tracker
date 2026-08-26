import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import config, { BACKEND_ROOT } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import apiRoutes from './routes.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(
    helmet({
      // Images are served cross-origin to the Vite dev server.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
    }),
  );
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`Origin ${origin} is not allowed by CORS`));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  if (config.env !== 'test') app.use(morgan('dev'));

  // Uploaded item photos (STORAGE_DRIVER=local)
  app.use('/uploads', express.static(config.storage.uploadDir, { maxAge: '7d' }));

  app.use('/api', apiRoutes);

  // Serve the built React app when it exists, so `npm start` alone can demo everything.
  const frontendDist = path.resolve(BACKEND_ROOT, '..', 'frontend', 'dist');
  if (fs.existsSync(path.join(frontendDist, 'index.html'))) {
    app.use(express.static(frontendDist));
    app.get(/^\/(?!api|uploads|socket\.io).*/, (req, res) => {
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  } else {
    app.get('/', (req, res) => {
      res.status(503).json({
        service: 'Lost & Found Item Tracker API',
        api_health: '/api/health',
        problem: 'The web UI has not been built yet, so there is nothing to serve on this port.',
        fix: 'Run `npm run build` in the repository root (or `npm start`, which builds first), then reload this page.',
      });
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
