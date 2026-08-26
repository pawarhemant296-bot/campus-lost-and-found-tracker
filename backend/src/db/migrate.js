/**
 * Creates (or recreates with --fresh) every table from the dialect schema file.
 *   node src/db/migrate.js
 *   node src/db/migrate.js --fresh
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../config/env.js';
import db from './index.js';

const here = path.dirname(fileURLToPath(import.meta.url));

const TABLES = ['audit_logs', 'notifications', 'messages', 'claims', 'matches', 'items', 'users'];

export async function migrate({ fresh = false, logger = console } = {}) {
  const schemaFile = path.join(here, `schema.${db.client}.sql`);
  const sql = fs.readFileSync(schemaFile, 'utf8');

  if (fresh) {
    logger.log(`[db] dropping existing tables (${db.client})`);
    for (const table of TABLES) {
      await db.script(`DROP TABLE IF EXISTS ${table}${db.client === 'postgres' ? ' CASCADE' : ''};`);
    }
  }

  await db.script(sql);
  logger.log(`[db] schema applied (${db.client}${db.client === 'sqlite' ? ` -> ${config.db.sqliteFile}` : ''})`);
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
  const fresh = process.argv.includes('--fresh');
  migrate({ fresh })
    .then(() => db.close())
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('[db] migration failed:', error.message);
      process.exit(1);
    });
}
