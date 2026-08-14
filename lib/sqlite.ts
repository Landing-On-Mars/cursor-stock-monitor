import "server-only";

import { DatabaseSync, type SQLInputValue } from "node:sqlite";

export type SqliteRunResult = {
  lastInsertRowid: number | bigint;
  changes: number;
};

type SqliteStatement = {
  get: (...params: unknown[]) => unknown;
  all: (...params: unknown[]) => unknown[];
  run: (...params: unknown[]) => SqliteRunResult;
};

export class SqliteDatabase {
  private readonly inner: DatabaseSync;

  constructor(filePath: string) {
    this.inner = new DatabaseSync(filePath, { timeout: 5000 });
  }

  exec(sql: string) {
    this.inner.exec(sql);
    return this;
  }

  close() {
    this.inner.close();
  }

  pragma(command: string, options?: { simple?: boolean }) {
    const sql = /^\s*pragma\b/i.test(command) ? command : `PRAGMA ${command}`;
    const row = this.inner.prepare(sql).get() as Record<string, unknown> | undefined;
    if (options?.simple) {
      return row ? Object.values(row)[0] : undefined;
    }
    return row;
  }

  prepare(sql: string): SqliteStatement {
    const statement = this.inner.prepare(sql);
    const bind = (params: unknown[]) => params as SQLInputValue[];
    return {
      get: (...params: unknown[]) => statement.get(...bind(params)),
      all: (...params: unknown[]) => statement.all(...bind(params)) as unknown[],
      run: (...params: unknown[]) => {
        const result = statement.run(...bind(params));
        return {
          lastInsertRowid: result.lastInsertRowid,
          changes: Number(result.changes),
        };
      },
    };
  }

  transaction<T>(fn: () => T): () => T {
    return () => {
      this.inner.exec("BEGIN");
      try {
        const value = fn();
        this.inner.exec("COMMIT");
        return value;
      } catch (error) {
        try {
          this.inner.exec("ROLLBACK");
        } catch {
          // Ignore rollback errors after a failed BEGIN/COMMIT.
        }
        throw error;
      }
    };
  }
}

export function isUniqueConstraintError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const code = "code" in error ? String(error.code) : "";
  return (
    code === "SQLITE_CONSTRAINT_UNIQUE" ||
    code === "ERR_SQLITE_ERROR" ||
    /unique constraint/i.test(error.message)
  );
}
