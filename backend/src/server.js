import http from 'node:http';
import createApp from './app.js';
import config, { validateConfig } from './config/env.js';
import db from './db/index.js';
import { migrate } from './db/migrate.js';
import { initRealtime } from './realtime/hub.js';

async function main() {
  validateConfig();

  // Keeps a fresh clone runnable with a single command.
  await migrate();

  const app = createApp();
  const server = http.createServer(app);
  initRealtime(server);

  server.listen(config.port, () => {
    console.log('');
    console.log('  Lost & Found Item Tracker API');
    console.log(`  ---------------------------------------------`);
    console.log(`  URL         : http://localhost:${config.port}`);
    console.log(`  Health      : http://localhost:${config.port}/api/health`);
    console.log(`  Database    : ${db.client}`);
    console.log(`  Storage     : ${config.storage.driver}`);
    console.log(`  AI matching : ${config.ai.enabled ? config.ai.url : 'disabled (local heuristics)'}`);
    console.log(`  Realtime    : socket.io on /socket.io`);
    console.log('');
  });

  const shutdown = async (signal) => {
    console.log(`\n[server] ${signal} received, shutting down`);
    server.close(async () => {
      await db.close().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('[server] failed to start:', error);
  process.exit(1);
});
