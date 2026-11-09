import { PGlite, type Transaction } from "@electric-sql/pglite";
import { migrate } from "./migrations";
import type { Db, Row } from "./types";

type Queryable = Pick<PGlite, "query" | "exec"> | Transaction;

function wrap(q: Queryable, root: PGlite): Db {
  return {
    async query<T extends Row>(sql: string, params: unknown[] = []) {
      const res = await q.query<T>(sql, params);
      return res.rows;
    },
    async exec(sql: string) {
      await q.exec(sql);
    },
    async transaction<T>(fn: (tx: Db) => Promise<T>) {
      if (q !== root) return fn(wrap(q, root)); // already inside a transaction
      return root.transaction((tx) => fn(wrap(tx, root)));
    },
  };
}

/** PGlite (PostgreSQL compiled to WASM). `dataDir` undefined = in memory. */
export async function createPgliteDb(dataDir?: string): Promise<Db> {
  const pg = await PGlite.create(dataDir);
  const db = wrap(pg, pg);
  await migrate(db);
  return db;
}
