import "server-only";

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const databasePath =
  process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "dashboard.db");

fs.mkdirSync(path.dirname(databasePath), { recursive: true });

function ensureColumn(
  database: Database.Database,
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

function migrateWatchlistCategories(database: Database.Database) {
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

function createDatabase() {
  const database = new Database(databasePath);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");

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

  // Drop legacy demo seed once; vault import becomes the source of truth.
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

const globalForDatabase = globalThis as typeof globalThis & {
  dashboardDatabase?: Database.Database;
};

export const db = globalForDatabase.dashboardDatabase ?? createDatabase();

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.dashboardDatabase = db;
}
