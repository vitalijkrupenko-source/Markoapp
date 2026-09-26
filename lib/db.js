import fs from 'node:fs';
import path from 'node:path';

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS workers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    token TEXT NOT NULL UNIQUE,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    slot TEXT NOT NULL CHECK (slot IN ('am', 'pm')),
    needed INTEGER NOT NULL CHECK (needed BETWEEN 1 AND 20),
    UNIQUE (date, slot)
  )`,
  `CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shift_id INTEGER NOT NULL,
    worker_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (shift_id, worker_id)
  )`,
  `CREATE INDEX IF NOT EXISTS requests_worker ON requests (worker_id)`,
  `CREATE INDEX IF NOT EXISTS shifts_date ON shifts (date)`,
];

let clientPromise = null;

/** Returns a ready libSQL client. The schema is created on first use, so no migration step is needed. */
export function db() {
  if (!clientPromise) {
    clientPromise = connect().catch((err) => {
      clientPromise = null;
      throw err;
    });
  }
  return clientPromise;
}

async function connect() {
  let url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN;

  let client;
  if (!url) {
    if (process.env.VERCEL) {
      throw new Error('Baza ni nastavljena: manjka TURSO_DATABASE_URL.');
    }
    const dir = path.join(process.cwd(), 'data');
    fs.mkdirSync(dir, { recursive: true });
    url = `file:${path.join(dir, 'urnik.db')}`;
  }

  if (url.startsWith('file:')) {
    const { createClient } = await import('@libsql/client');
    client = createClient({ url });
  } else {
    const { createClient } = await import('@libsql/client/web');
    client = createClient({ url, authToken });
  }

  await client.batch(SCHEMA, 'write');
  return client;
}

/** Converts libSQL rows into plain objects with numbers instead of bigints. */
export function rows(result) {
  return result.rows.map((row) => {
    const out = {};
    for (const col of result.columns) {
      const v = row[col];
      out[col] = typeof v === 'bigint' ? Number(v) : v;
    }
    return out;
  });
}
