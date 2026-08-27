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

/**
 * Columns added after the first release. `CREATE TABLE IF NOT EXISTS` does not
 * touch existing tables, so databases created by an earlier version need these
 * filled in explicitly. Adding a nullable column is safe to repeat.
 */
const ADDED_COLUMNS = [
  { table: 'claims', column: 'image_score', type: 'REAL' },
  { table: 'claims', column: 'image_verdict', type: 'TEXT' },
];

async function existingColumns(table) {
  if (db.client === 'postgres') {
    const rows = await db.all('SELECT column_name AS name FROM information_schema.columns WHERE table_name = ?', [
      table,
    ]);
    return new Set(rows.map((row) => row.name));
  }
  const rows = await db.all(`PRAGMA table_info(${table})`);
  return new Set(rows.map((row) => row.name));
}

async function applyAddedColumns(logger) {
  for (const { table, column, type } of ADDED_COLUMNS) {
    const columns = await existingColumns(table);
    if (columns.size === 0 || columns.has(column)) continue;
    await db.script(`ALTER TABLE ${table} ADD COLUMN ${column} ${type};`);
    logger.log(`[db] added column ${table}.${column}`);
  }
}

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
  await applyAddedColumns(logger);
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
