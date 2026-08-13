import "server-only";

import fs from "node:fs";
import path from "node:path";
import {
  DATABASE_FILENAME,
  defaultDatabasePath,
  normalizeDatabaseDir,
  readLocalConfig,
  writeLocalConfig,
} from "@/lib/local-config";
import { SqliteDatabase } from "@/lib/sqlite";

const globalForDatabase = globalThis as typeof globalThis & {
  dashboardDatabase?: SqliteDatabase;
  dashboardDatabasePath?: string;
};

function envDatabasePath() {
  const value = process.env.DATABASE_PATH?.trim();
  return value ? path.resolve(value) : "";
}

export function resolveDatabasePath() {
  const fromEnv = envDatabasePath();
  if (fromEnv) return fromEnv;

  const configuredDir = readLocalConfig().databaseDir?.trim();
  if (configuredDir) {
    return path.join(path.resolve(configuredDir), DATABASE_FILENAME);
  }

  return defaultDatabasePath();
}

export function databaseUsesSyncFolder() {
  return !envDatabasePath() && Boolean(readLocalConfig().databaseDir?.trim());
}

function ensureDatabaseDir(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function ensureColumn(
  database: SqliteDatabase,
  table: string,
  column: string,
  definition: string,
) {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
  }>;
  if (!columns.some((entry) => entry.name === column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function migrateWatchlistCategories(database: SqliteDatabase) {
  const table = database
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'watchlist_items'",
    )
    .get() as { sql?: string } | undefined;

  if (!table?.sql || table.sql.includes("'ARCHIVE'")) return;

  database.transaction(() => {
    database.exec(`
      CREATE TABLE watchlist_items_next (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL COLLATE NOCASE,
        name TEXT NOT NULL,
        market TEXT NOT NULL CHECK (market IN ('US', 'HK', 'CN')),
        category TEXT NOT NULL CHECK (category IN ('CORE', 'WATCH', 'ARCHIVE')),
        note TEXT NOT NULL DEFAULT '',
        note_path TEXT NOT NULL DEFAULT '',
        exchange TEXT NOT NULL DEFAULT '',
        currency TEXT NOT NULL DEFAULT '',
        industries TEXT NOT NULL DEFAULT '[]',
        tags TEXT NOT NULL DEFAULT '[]',
        thesis TEXT NOT NULL DEFAULT '',
        article_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(symbol, market)
      );

      INSERT INTO watchlist_items_next (
        id, symbol, name, market, category, note, note_path, exchange,
        currency, industries, tags, thesis, article_count, created_at
      )
      SELECT
        id, symbol, name, market,
        CASE category WHEN 'LOW_FREQUENCY' THEN 'ARCHIVE' ELSE category END,
        note, note_path, exchange,
        currency, industries, tags, thesis, article_count, created_at
      FROM watchlist_items;

      DROP TABLE watchlist_items;
      ALTER TABLE watchlist_items_next RENAME TO watchlist_items;
    `);
  })();
}

function createDatabase(filePath: string) {
  ensureDatabaseDir(filePath);
  const database = new SqliteDatabase(filePath);
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");
  // Cloud-synced folders (Google Drive) corrupt WAL sidecar files; use a single .db.
  database.pragma(
    databaseUsesSyncFolder() ? "journal_mode = DELETE" : "journal_mode = WAL",
  );

  database.exec(`
    CREATE TABLE IF NOT EXISTS watchlist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL COLLATE NOCASE,
      name TEXT NOT NULL,
      market TEXT NOT NULL CHECK (market IN ('US', 'HK', 'CN')),
      category TEXT NOT NULL CHECK (category IN ('CORE', 'WATCH', 'ARCHIVE')),
      note TEXT NOT NULL DEFAULT '',
      note_path TEXT NOT NULL DEFAULT '',
      exchange TEXT NOT NULL DEFAULT '',
      currency TEXT NOT NULL DEFAULT '',
      industries TEXT NOT NULL DEFAULT '[]',
      tags TEXT NOT NULL DEFAULT '[]',
      thesis TEXT NOT NULL DEFAULT '',
      article_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(symbol, market)
    );

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  ensureColumn(database, "watchlist_items", "note_path", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, "watchlist_items", "exchange", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, "watchlist_items", "currency", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, "watchlist_items", "industries", "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(database, "watchlist_items", "tags", "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(database, "watchlist_items", "thesis", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(
    database,
    "watchlist_items",
    "article_count",
    "INTEGER NOT NULL DEFAULT 0",
  );
  migrateWatchlistCategories(database);

  const legacyCleared = database
    .prepare("SELECT value FROM app_meta WHERE key = 'legacy_seed_cleared_v2'")
    .get();

  if (!legacyCleared) {
    database.transaction(() => {
      database
        .prepare(
          `DELETE FROM watchlist_items
           WHERE symbol IN ('NVDA', '0700', '600519')
             AND note_path = ''`,
        )
        .run();
      database
        .prepare(
          "INSERT INTO app_meta (key, value) VALUES ('legacy_seed_cleared_v2', '1')",
        )
        .run();
      database.prepare("DELETE FROM app_meta WHERE key = 'watchlist_seeded'").run();
    })();
  }

  return database;
}

function checkpointAndClose(database: SqliteDatabase) {
  try {
    database.pragma("wal_checkpoint(TRUNCATE)");
  } catch {
    // Ignore: DELETE journal mode has no WAL.
  }
  database.close();
}

export function closeDatabase() {
  const existing = globalForDatabase.dashboardDatabase;
  if (!existing) return;
  checkpointAndClose(existing);
  globalForDatabase.dashboardDatabase = undefined;
  globalForDatabase.dashboardDatabasePath = undefined;
}

export function getDb() {
  const filePath = resolveDatabasePath();
  const existing = globalForDatabase.dashboardDatabase;
  if (existing && globalForDatabase.dashboardDatabasePath === filePath) {
    return existing;
  }
  if (existing) checkpointAndClose(existing);
  const database = createDatabase(filePath);
  globalForDatabase.dashboardDatabase = database;
  globalForDatabase.dashboardDatabasePath = filePath;
  return database;
}

/** @deprecated use getDb() so the connection can follow a new sync folder */
export const db = new Proxy({} as SqliteDatabase, {
  get(_target, property) {
    const connection = getDb();
    const value = Reflect.get(connection, property, connection) as unknown;
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(connection)
      : value;
  },
});

function assertWritableDirectory(directory: string) {
  const root = path.parse(directory).root;
  if (root && !fs.existsSync(root)) {
    throw new Error(`盘符不存在：${root}。请确认 Google Drive 已启动并完成同步。`);
  }

  fs.mkdirSync(directory, { recursive: true });
  const probe = path.join(directory, ".northstar-write-check");
  try {
    fs.writeFileSync(probe, "ok");
    fs.unlinkSync(probe);
  } catch {
    throw new Error("该文件夹无法写入。请检查 Google Drive 是否已镜像到本地。");
  }
}

export function setDatabaseDir(input: string) {
  if (envDatabasePath()) {
    throw new Error("当前由环境变量 DATABASE_PATH 指定数据库，无法在设置里改路径。");
  }

  const directory = normalizeDatabaseDir(input);
  if (!directory) {
    throw new Error("请填写 Google Drive 同步文件夹路径。");
  }

  assertWritableDirectory(directory);

  const nextPath = path.join(directory, DATABASE_FILENAME);
  const currentPath = resolveDatabasePath();

  if (path.resolve(currentPath) !== path.resolve(nextPath)) {
    const current = getDb();
    try {
      current.pragma("wal_checkpoint(TRUNCATE)");
    } catch {
      // Ignore missing WAL.
    }
    if (!fs.existsSync(nextPath) && fs.existsSync(currentPath)) {
      fs.copyFileSync(currentPath, nextPath);
    }
    closeDatabase();
  }

  writeLocalConfig({ databaseDir: directory });
  closeDatabase();
  return getDb();
}

export function databaseStatus() {
  const filePath = resolveDatabasePath();
  const fromEnv = envDatabasePath();
  const configuredDir = readLocalConfig().databaseDir?.trim() || "";
  let sizeBytes = 0;
  let watchlistCount = 0;
  let journalMode = "";
  let available = false;
  let error = "";

  try {
    const database = getDb();
    available = fs.existsSync(filePath);
    sizeBytes = available ? fs.statSync(filePath).size : 0;
    watchlistCount = (
      database.prepare("SELECT COUNT(*) AS count FROM watchlist_items").get() as {
        count: number;
      }
    ).count;
    journalMode = String(database.pragma("journal_mode", { simple: true }) ?? "");
  } catch (statusError) {
    error = statusError instanceof Error ? statusError.message : "数据库无法打开。";
  }

  return {
    available,
    configuredDir: configuredDir || null,
    envOverride: fromEnv || null,
    filePath,
    filename: DATABASE_FILENAME,
    journalMode,
    sizeBytes,
    syncFolder: databaseUsesSyncFolder(),
    watchlistCount,
    error: error || undefined,
  };
}
