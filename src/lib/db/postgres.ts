import postgres from "postgres";
import { migrate } from "./migrations";
import type { Db, Row } from "./types";

type Sql = postgres.Sql | postgres.TransactionSql;

function wrap(sql: Sql, inTx: boolean): Db {
  return {
    async query<T extends Row>(text: string, params: unknown[] = []) {
      const rows = await sql.unsafe(text, params as postgres.ParameterOrJSON<never>[]);
      return rows as unknown as T[];
    },
    async exec(text: string) {
      await sql.unsafe(text);
    },
    async transaction<T>(fn: (tx: Db) => Promise<T>) {
      if (inTx) return fn(wrap(sql, true));
      const result = await (sql as postgres.Sql).begin((tx) => fn(wrap(tx, true)));
      return result as T;
    },
  };
}

export async function createPostgresDb(url: string): Promise<Db> {
  const sql = postgres(url, { max: 5, idle_timeout: 20, prepare: false });
  const db = wrap(sql, false);
  await migrate(db);
  return db;
}
