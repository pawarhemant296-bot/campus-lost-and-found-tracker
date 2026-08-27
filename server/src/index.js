import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { config, ROOT } from './config.js';
import { db } from './db.js';
import { optionalAuth } from './auth.js';
import { hasSharp } from './images.js';

import authRoutes from './routes/auth.js';
import itemRoutes from './routes/items.js';
import matchRoutes from './routes/matches.js';
import claimRoutes from './routes/claims.js';
import messageRoutes from './routes/messages.js';
import notificationRoutes from './routes/notifications.js';
import adminRoutes from './routes/admin.js';
import metaRoutes from './routes/meta.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(config.uploadDir, { maxAge: '7d' }));
app.use(optionalAuth);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'traceback-api',
    image_similarity: hasSharp,
    users: db.prepare('SELECT COUNT(*) AS c FROM users').get().c,
    items: db.prepare('SELECT COUNT(*) AS c FROM items').get().c,
    uptime: Math.round(process.uptime()),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/meta', metaRoutes);

// Serve the production build of the React client when it exists.
const clientDist = path.resolve(ROOT, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api|uploads).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || (err.message?.includes('image uploads') ? 400 : 500);
  if (status >= 500) console.error('[traceback]', err);
  res.status(status).json({ error: err.message || 'Something went wrong' });
});

app.listen(config.port, () => {
  console.log(`\n  ⟡ TraceBack API listening on http://localhost:${config.port}`);
  console.log(`    image similarity: ${hasSharp ? 'enabled (dHash)' : 'disabled'}`);
  console.log(`    database: ${config.dbFile}\n`);
});
