/**
 * SQLite driver adapter
 * ---------------------------------------------------------------------------
 * TraceBack must install cleanly on a laptop with no C++ toolchain — a Windows
 * machine without Visual Studio Build Tools is the common hackathon case. So the
 * database layer speaks to whichever driver is available, preferring the one
 * that needs no compilation:
 *
 *   1. node:sqlite   — built into Node 22.5+ / 24. Zero install, zero build.
 *   2. better-sqlite3 — used when present (needed on Node 18/20, which have no
 *                       node:sqlite). Declared as an *optional* dependency, so a
 *                       failed native build can never break `npm install`.
 *
 * Both are exposed through the small surface the app actually uses:
 *   db.exec(sql) · db.pragma(text) · db.prepare(sql) -> { run, get, all } ·
 *   db.transaction(fn) -> callable · db.driver
 */

let betterSqlite3 = null;
try {
  betterSqlite3 = (await import('better-sqlite3')).default;
} catch {
  /* not installed, or its native build failed — node:sqlite will be used */
}

let NodeSqlite = null;
if (!betterSqlite3) {
  try {
    // Node prints an ExperimentalWarning for node:sqlite; it is stable enough for
    // our use and the noise is unhelpful to users, so filter just that warning.
    const original = process.emitWarning;
    process.emitWarning = (warning, ...rest) => {
      const name = typeof warning === 'object' ? warning?.name : rest[0];
      const text = String(typeof warning === 'object' ? warning?.message : warning);
      if (name === 'ExperimentalWarning' && text.includes('SQLite')) return;
      return original.call(process, warning, ...rest);
    };
    NodeSqlite = (await import('node:sqlite')).DatabaseSync;
  } catch {
    /* neither driver available — reported below */
  }
}

const toNumber = (v) => (typeof v === 'bigint' ? Number(v) : v);

/** Wraps node:sqlite's DatabaseSync in the better-sqlite3-shaped surface. */
function wrapNodeSqlite(file) {
  const db = new NodeSqlite(file);

  const prepare = (sql) => {
    const stmt = db.prepare(sql);
    return {
      run: (...params) => {
        const info = stmt.run(...params);
        return {
          changes: toNumber(info?.changes ?? 0),
          lastInsertRowid: toNumber(info?.lastInsertRowid ?? 0),
        };
      },
      get: (...params) => stmt.get(...params),
      all: (...params) => stmt.all(...params),
    };
  };

  return {
    driver: 'node:sqlite',
    exec: (sql) => db.exec(sql),
    pragma: (text) => db.exec(`PRAGMA ${text};`),
    prepare,
    /** BEGIN/COMMIT/ROLLBACK wrapper matching better-sqlite3's db.transaction(). */
    transaction:
      (fn) =>
      (...args) => {
        db.exec('BEGIN');
        try {
          const result = fn(...args);
          db.exec('COMMIT');
          return result;
        } catch (err) {
          try {
            db.exec('ROLLBACK');
          } catch {
            /* the transaction was already rolled back */
          }
          throw err;
        }
      },
    close: () => db.close(),
  };
}

function wrapBetterSqlite3(file) {
  const db = new betterSqlite3(file);
  const prepare = (sql) => {
    const stmt = db.prepare(sql);
    return {
      run: (...params) => {
        const info = stmt.run(...params);
        return { changes: info.changes, lastInsertRowid: toNumber(info.lastInsertRowid) };
      },
      get: (...params) => stmt.get(...params),
      all: (...params) => stmt.all(...params),
    };
  };
  return {
    driver: 'better-sqlite3',
    exec: (sql) => db.exec(sql),
    pragma: (text) => db.pragma(text),
    prepare,
    transaction: (fn) => db.transaction(fn),
    close: () => db.close(),
  };
}

export function openDatabase(file) {
  if (betterSqlite3) return wrapBetterSqlite3(file);
  if (NodeSqlite) return wrapNodeSqlite(file);

  const [major, minor] = process.versions.node.split('.').map(Number);
  throw new Error(
    [
      'No SQLite driver is available.',
      '',
      `You are running Node ${process.versions.node}.`,
      major > 22 || (major === 22 && minor >= 5)
        ? 'That version includes node:sqlite, so this should not happen — please open an issue.'
        : 'Node 22.5 or newer has SQLite built in and needs no compilation. Either:',
      major > 22 || (major === 22 && minor >= 5)
        ? ''
        : '  • upgrade Node (recommended): https://nodejs.org  — then re-run npm run setup',
      major > 22 || (major === 22 && minor >= 5)
        ? ''
        : '  • or install the optional native driver: npm --prefix server install better-sqlite3',
      '',
    ]
      .filter((l) => l !== '')
      .join('\n')
  );
}

export const availableDriver = betterSqlite3
  ? 'better-sqlite3'
  : NodeSqlite
    ? 'node:sqlite'
    : 'none';
