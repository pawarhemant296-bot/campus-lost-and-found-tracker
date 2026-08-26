/**
 * Thin database layer that speaks two dialects.
 *
 *   DB_CLIENT=sqlite    -> better-sqlite3, single file, zero configuration (default)
 *   DB_CLIENT=postgres  -> pg pool, driven by DATABASE_URL
 *
 * Application code always writes portable SQL with `?` placeholders and gets
 * back plain objects with ISO-8601 date strings, whichever driver is active.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import config from '../config/env.js';

// `require` shim so both native drivers stay optional inside an ESM project:
// only the configured driver is ever loaded.
const require = createRequire(import.meta.url);

/** SQLite cannot bind booleans/undefined; normalise for both drivers. */
function normalizeParams(params = []) {
  return params.map((value) => {
    if (value === undefined) return null;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (value instanceof Date) return value.toISOString();
    return value;
  });
}

/** `?, ?` -> `$1, $2` for PostgreSQL. */
function toPositional(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

/** PostgreSQL returns Date objects; the API contract is ISO strings. */
function normalizeRow(row) {
  if (!row || typeof row !== 'object') return row;
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (value instanceof Date) out[key] = value.toISOString();
    else if (typeof value === 'boolean') out[key] = value ? 1 : 0;
    else out[key] = value;
  }
  return out;
}

function createSqliteAdapter() {
  const Database = require('better-sqlite3');
  fs.mkdirSync(path.dirname(config.db.sqliteFile), { recursive: true });
  const handle = new Database(config.db.sqliteFile);
  handle.pragma('journal_mode = WAL');
  handle.pragma('foreign_keys = ON');

  const exec = (sql, params) => {
    const statement = handle.prepare(sql);
    const bound = normalizeParams(params);
    if (statement.reader) {
      return { rows: statement.all(...bound), changes: 0 };
    }
    const info = statement.run(...bound);
    return { rows: [], changes: info.changes, lastInsertRowid: info.lastInsertRowid };
  };

  return {
    name: 'sqlite',
    async query(sql, params) {
      return exec(sql, params);
    },
    async script(sql) {
      handle.exec(sql);
    },
    async transaction(work) {
      handle.exec('BEGIN');
      try {
        const result = await work();
        handle.exec('COMMIT');
        return result;
      } catch (error) {
        try {
          handle.exec('ROLLBACK');
        } catch {
          /* connection already unwound */
        }
        throw error;
      }
    },
    async close() {
      handle.close();
    },
    raw: handle,
  };
}

function createPostgresAdapter() {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: config.db.connectionString, max: 10 });

  // Single connection is used for transactions so BEGIN/COMMIT stay on one session.
  let txClient = null;

  const runner = () => txClient ?? pool;

  return {
    name: 'postgres',
    async query(sql, params) {
      const result = await runner().query(toPositional(sql), normalizeParams(params));
      return { rows: (result.rows ?? []).map(normalizeRow), changes: result.rowCount ?? 0 };
    },
    async script(sql) {
      await runner().query(sql);
    },
    async transaction(work) {
      const client = await pool.connect();
      txClient = client;
      try {
        await client.query('BEGIN');
        const result = await work();
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        txClient = null;
        client.release();
      }
    },
    async close() {
      await pool.end();
    },
    raw: pool,
  };
}

const adapter = config.db.client === 'postgres' ? createPostgresAdapter() : createSqliteAdapter();

export const db = {
  /** Active driver name: 'sqlite' | 'postgres'. */
  client: adapter.name,

  /** Returns every matching row. */
  async all(sql, params = []) {
    const { rows } = await adapter.query(sql, params);
    return rows;
  },

  /** Returns the first row, or null. */
  async one(sql, params = []) {
    const { rows } = await adapter.query(sql, params);
    return rows[0] ?? null;
  },

  /** Executes a write. Use `RETURNING` to get the new row back on both drivers. */
  async run(sql, params = []) {
    return adapter.query(sql, params);
  },

  /** Convenience for `INSERT ... RETURNING *`. */
  async insertReturning(sql, params = []) {
    const { rows } = await adapter.query(sql, params);
    return rows[0] ?? null;
  },

  /** Runs multi-statement SQL (migrations). */
  async script(sql) {
    return adapter.script(sql);
  },

  /** All-or-nothing unit of work. */
  async transaction(work) {
    return adapter.transaction(work);
  },

  async close() {
    return adapter.close();
  },

  raw: adapter.raw,
};

export default db;
