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

/**
 * Brings the schema up to date. Cheap when nothing is pending (one small
 * read, no locks), so it is safe to run on every cold start. When work is
 * pending, an advisory lock makes concurrent servers apply it exactly once.
 */
export async function migrate(db: Db): Promise<void> {
  const latest = MIGRATIONS.at(-1)!.id;
  await db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (id integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`,
  );
  if ((await appliedMax(db)) >= latest) return;

  await db.transaction(async (tx) => {
    await tx.query("SELECT pg_advisory_xact_lock($1::bigint)", [LOCK_KEY]);
    await tx.exec("SET LOCAL lock_timeout = '10s'");
    const rows = await tx.query<{ id: number }>("SELECT id FROM schema_migrations");
    const done = new Set(rows.map((r) => Number(r.id)));
    for (const m of MIGRATIONS) {
      if (done.has(m.id)) continue;
      await tx.exec(m.sql);
      await tx.query("INSERT INTO schema_migrations (id) VALUES ($1)", [m.id]);
    }
  });
}

async function appliedMax(db: Db): Promise<number> {
  const [row] = await db.query<{ max: number | null }>("SELECT max(id) AS max FROM schema_migrations");
  return Number(row?.max ?? 0);
}
