export type Row = Record<string, unknown>;

/** The small slice of SQL access the app needs. Placeholders use $1, $2, … */
export interface Db {
  query<T extends Row = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Runs SQL that may hold several statements and takes no parameters. */
  exec(sql: string): Promise<void>;
  /** Runs several statements atomically. */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
}
