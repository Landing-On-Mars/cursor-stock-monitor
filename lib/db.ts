import "server-only";

import fs from "node:fs";
import path from "node:path";
import { SqliteDatabase } from "@/lib/sqlite";

const databasePath =
  process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "dashboard.db");

fs.mkdirSync(path.dirname(databasePath), { recursive: true });

function migrateWatchlistConstraints(database: SqliteDatabase) {
  database.exec("BEGIN IMMEDIATE");
  try {
    const claimed = database
      .prepare("INSERT OR IGNORE INTO app_meta (key, value) VALUES ('watchlist_schema_v2', '1')")
      .run();

    if (claimed.changes === 1) {
      const row = database
        .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'watchlist_items'")
        .get() as { sql?: string } | undefined;
      const sql = row?.sql ?? "";
      const alreadyNew =
        sql.includes("CORE', 'WATCH', 'OTHER") && sql.includes("'US', 'HK', 'CN', 'OTHER'");

      if (!alreadyNew) {
        database.exec(`
          CREATE TABLE watchlist_items_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL COLLATE NOCASE,
            name TEXT NOT NULL,
            market TEXT NOT NULL CHECK (market IN ('US', 'HK', 'CN', 'OTHER')),
            category TEXT NOT NULL CHECK (category IN ('CORE', 'WATCH', 'OTHER')),
            note TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(symbol, market)
          );
          INSERT INTO watchlist_items_new (id, symbol, name, market, category, note, created_at)
          SELECT id, symbol, name, market, category, note, created_at FROM watchlist_items;
          DROP TABLE watchlist_items;
          ALTER TABLE watchlist_items_new RENAME TO watchlist_items;
        `);
      }
    }

    database.exec("COMMIT");
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {
      // Ignore rollback errors after a failed BEGIN/COMMIT.
    }
    throw error;
  }
}

function createDatabase() {
  const database = new SqliteDatabase(databasePath);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");

  database.exec(`
    CREATE TABLE IF NOT EXISTS watchlist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL COLLATE NOCASE,
      name TEXT NOT NULL,
      market TEXT NOT NULL CHECK (market IN ('US', 'HK', 'CN', 'OTHER')),
      category TEXT NOT NULL CHECK (category IN ('CORE', 'WATCH', 'OTHER')),
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(symbol, market)
    );

    CREATE TABLE IF NOT EXISTS focus_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL COLLATE NOCASE,
      market TEXT NOT NULL,
      noted_at TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  migrateWatchlistConstraints(database);

  const seed = database.prepare(`
      INSERT OR IGNORE INTO watchlist_items
        (symbol, name, market, category, note)
      VALUES (?, ?, ?, ?, ?)
    `);

  const claimed = database
    .prepare(
      "INSERT OR IGNORE INTO app_meta (key, value) VALUES ('watchlist_seeded', '1')",
    )
    .run();

  if (claimed.changes === 1) {
    database.transaction(() => {
      seed.run("MRVL", "Marvell Technology", "US", "CORE", "光DSP 与定制 ASIC");
      seed.run("0700", "腾讯控股", "HK", "CORE", "微信生态与广告增量");
      seed.run("3993", "洛阳钼业", "HK", "WATCH", "铜钴金产量与并购节奏");
    })();
  }

  return database;
}

const globalForDatabase = globalThis as typeof globalThis & {
  dashboardDatabase?: SqliteDatabase;
};

export const db = globalForDatabase.dashboardDatabase ?? createDatabase();

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.dashboardDatabase = db;
}
