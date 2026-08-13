import "server-only";

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const databasePath =
  process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "dashboard.db");

fs.mkdirSync(path.dirname(databasePath), { recursive: true });

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
      category TEXT NOT NULL CHECK (category IN ('CORE', 'WATCH')),
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(symbol, market)
    );

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const seeded = database
    .prepare("SELECT value FROM app_meta WHERE key = 'watchlist_seeded'")
    .get();

  if (!seeded) {
    const seed = database.prepare(`
      INSERT OR IGNORE INTO watchlist_items
        (symbol, name, market, category, note)
      VALUES (?, ?, ?, ?, ?)
    `);

    database.transaction(() => {
      seed.run("NVDA", "NVIDIA", "US", "CORE", "AI 算力核心跟踪标的");
      seed.run("0700", "腾讯控股", "HK", "CORE", "游戏与广告业务恢复");
      seed.run("600519", "贵州茅台", "CN", "WATCH", "等待渠道库存进一步改善");
      database
        .prepare(
          "INSERT INTO app_meta (key, value) VALUES ('watchlist_seeded', '1')",
        )
        .run();
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
