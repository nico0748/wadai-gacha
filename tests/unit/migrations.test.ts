import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { MIGRATIONS, migrate } from "@/lib/db/migrations";
import { createPgliteDb } from "@/lib/db/pglite";
import { SCHEMA_SQL } from "@/lib/db/schema";
import type { Db, Row } from "@/lib/db/types";

/** A Db over a raw PGlite, so a test can set up an old schema first. */
function wrap(pg: PGlite): Db {
  const db: Db = {
    async query<T extends Row>(sql: string, params: unknown[] = []) {
      return (await pg.query<T>(sql, params)).rows;
    },
    async exec(sql: string) {
      await pg.exec(sql);
    },
    async transaction(fn) {
      return pg.transaction((tx) =>
        fn({
          async query<T extends Row>(sql: string, params: unknown[] = []) {
            return (await tx.query<T>(sql, params)).rows;
          },
          async exec(sql: string) {
            await tx.exec(sql);
          },
          transaction: (inner) => inner(db),
        }),
      );
    },
  };
  return db;
}

describe("migrate", () => {
  it("upgrades a database created by the MVP and keeps its rows", async () => {
    const pg = await PGlite.create();
    await pg.exec(SCHEMA_SQL); // what an MVP deployment has: no schema_migrations table
    await pg.query(
      `INSERT INTO rooms (code, expires_at) VALUES ('OLD123', now() + interval '1 day')`,
    );
    const db = wrap(pg);

    await migrate(db);

    const [room] = await db.query<{ version: number; reveal_at: unknown; authors_shown: unknown }>(
      "SELECT version, reveal_at, authors_shown FROM rooms WHERE code = 'OLD123'",
    );
    expect(room).toEqual({ version: 0, reveal_at: null, authors_shown: null });
    const applied = await db.query<{ id: number }>("SELECT id FROM schema_migrations ORDER BY id");
    expect(applied.map((r) => r.id)).toEqual(MIGRATIONS.map((m) => m.id));
  });

  it("does nothing when run again", async () => {
    const db = await createPgliteDb();
    await migrate(db);
    await migrate(db);
    const applied = await db.query("SELECT id FROM schema_migrations");
    expect(applied).toHaveLength(MIGRATIONS.length);
  });
});
