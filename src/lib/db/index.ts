import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { Db } from "./types";

export type { Db } from "./types";

const globalForDb = globalThis as unknown as { __wadaiDb?: Promise<Db> };

/**
 * One shared connection per server process. DATABASE_URL selects PostgreSQL
 * (production); without it, a PGlite database is kept in `.data/pglite`
 * so local development needs no setup.
 */
export function getDb(): Promise<Db> {
  if (!globalForDb.__wadaiDb) {
    globalForDb.__wadaiDb = open().catch((err) => {
      globalForDb.__wadaiDb = undefined;
      throw err;
    });
  }
  return globalForDb.__wadaiDb;
}

async function open(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { createPostgresDb } = await import("./postgres");
    return createPostgresDb(url);
  }
  const { createPgliteDb } = await import("./pglite");
  // The ignore comment keeps the build from tracing the whole project into the server bundle.
  const dir = path.resolve(
    /*turbopackIgnore: true*/ process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite"),
  );
  await mkdir(dir, { recursive: true });
  return createPgliteDb(dir);
}
