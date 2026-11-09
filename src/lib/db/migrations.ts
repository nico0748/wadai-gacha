import { SCHEMA_SQL } from "./schema";
import type { Db } from "./types";

/**
 * Ordered, additive schema changes. Never edit an entry once it has shipped:
 * add a new one. Only add things (tables, nullable columns, columns with a
 * constant default) so that an older server still running during a deploy
 * keeps working; remove or rename over two releases.
 */
export const MIGRATIONS: { id: number; sql: string }[] = [
  // Baseline: the MVP schema. Already idempotent, so existing databases
  // that predate this table simply record it.
  { id: 1, sql: SCHEMA_SQL },
  {
    id: 2,
    sql: `
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 0;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS reveal_at timestamptz;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS authors_shown integer;
ALTER TABLE room_topics ADD COLUMN IF NOT EXISTS rare boolean NOT NULL DEFAULT false;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS misses_since_rare integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS rate_limits (
  key           text NOT NULL,
  window_start  timestamptz NOT NULL,
  count         integer NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);
CREATE INDEX IF NOT EXISTS rate_limits_window_idx ON rate_limits (window_start);

CREATE TABLE IF NOT EXISTS app_secrets (
  name        text PRIMARY KEY,
  value       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
`,
  },
];

// Any constant works; it only has to be the same for every server.
const LOCK_KEY = 731_120_411;
// How long one attempt may wait for a table lock (e.g. behind a long query on
// rooms). Short, because every query on that table queues behind the ALTER
// while it waits; failed attempts are retried after a pause.
const LOCK_TIMEOUT = "3s";
const ATTEMPTS = 5;

/**
 * Brings the schema up to date. Cheap when nothing is pending (two small
 * reads, no locks), so it is safe to run on every cold start. When work is
 * pending, an advisory lock makes concurrent servers apply it exactly once:
 * the others wait on that lock, holding no table locks, and then find nothing
 * left to do.
 */
export async function migrate(db: Db): Promise<void> {
  const latest = MIGRATIONS.at(-1)!.id;
  if ((await appliedMax(db)) >= latest) return;
  for (let attempt = 1; ; attempt++) {
    try {
      await applyPending(db);
      return;
    } catch (err) {
      if (!isLockTimeout(err) || attempt >= ATTEMPTS) throw err;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
}

async function applyPending(db: Db): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.query("SELECT pg_advisory_xact_lock($1::bigint)", [LOCK_KEY]);
    // Created under the lock: concurrent CREATE TABLE IF NOT EXISTS can still collide.
    await tx.exec(
      `CREATE TABLE IF NOT EXISTS schema_migrations (id integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`,
    );
    const rows = await tx.query<{ id: number }>("SELECT id FROM schema_migrations");
    const done = new Set(rows.map((r) => Number(r.id)));
    const pending = MIGRATIONS.filter((m) => !done.has(m.id));
    if (pending.length === 0) return;
    await tx.exec(`SET LOCAL lock_timeout = '${LOCK_TIMEOUT}'`);
    for (const m of pending) {
      await tx.exec(m.sql);
      await tx.query("INSERT INTO schema_migrations (id) VALUES ($1)", [m.id]);
    }
  });
}

async function appliedMax(db: Db): Promise<number> {
  const [table] = await db.query<{ name: string | null }>("SELECT to_regclass('schema_migrations')::text AS name");
  if (!table?.name) return 0;
  const [row] = await db.query<{ max: number | null }>("SELECT max(id) AS max FROM schema_migrations");
  return Number(row?.max ?? 0);
}

/** Postgres lock_not_available (55P03), raised when lock_timeout runs out. */
function isLockTimeout(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === "55P03";
}
