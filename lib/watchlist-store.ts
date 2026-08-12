import { db } from "@/lib/db";
import type {
  CreateWatchlistItem,
  Market,
  WatchlistCategory,
  WatchlistItem,
} from "@/lib/watchlist-types";

export type WatchlistRow = {
  id: number;
  symbol: string;
  name: string;
  market: Market;
  category: WatchlistCategory;
  note: string;
  note_path: string;
  exchange: string;
  currency: string;
  industries: string;
  tags: string;
  thesis: string;
  article_count: number;
  created_at: string;
};

function parseJsonArray(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function toWatchlistItem(row: WatchlistRow): WatchlistItem {
  return {
    id: row.id,
    symbol: row.symbol,
    name: row.name,
    market: row.market,
    category: row.category,
    note: row.note,
    notePath: row.note_path,
    exchange: row.exchange,
    currency: row.currency,
    industries: parseJsonArray(row.industries),
    tags: parseJsonArray(row.tags),
    thesis: row.thesis,
    articleCount: row.article_count,
    createdAt: row.created_at,
  };
}

export function listWatchlistItems() {
  const rows = db
    .prepare(
      `SELECT id, symbol, name, market, category, note, note_path, exchange,
              currency, industries, tags, thesis, article_count, created_at
       FROM watchlist_items
       ORDER BY
         CASE category
           WHEN 'CORE' THEN 0
           WHEN 'WATCH' THEN 1
           WHEN 'ARCHIVE' THEN 2
           ELSE 3
         END,
         CASE market WHEN 'HK' THEN 0 WHEN 'CN' THEN 1 ELSE 2 END,
         symbol ASC`,
    )
    .all() as WatchlistRow[];

  return rows.map(toWatchlistItem);
}

export function getWatchlistItem(id: number) {
  const row = db
    .prepare(
      `SELECT id, symbol, name, market, category, note, note_path, exchange,
              currency, industries, tags, thesis, article_count, created_at
       FROM watchlist_items WHERE id = ?`,
    )
    .get(id) as WatchlistRow | undefined;
  return row ? toWatchlistItem(row) : null;
}

export function insertWatchlistItem(item: CreateWatchlistItem) {
  const result = db
    .prepare(
      `INSERT INTO watchlist_items
        (symbol, name, market, category, note, note_path, exchange, currency,
         industries, tags, thesis, article_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      item.symbol.trim().toUpperCase(),
      item.name.trim(),
      item.market,
      item.category,
      item.note?.trim() ?? "",
      item.notePath ?? "",
      item.exchange ?? "",
      item.currency ?? "",
      JSON.stringify(item.industries ?? []),
      JSON.stringify(item.tags ?? []),
      item.thesis ?? "",
      item.articleCount ?? 0,
    );

  return getWatchlistItem(Number(result.lastInsertRowid));
}

export function upsertVaultWatchlistItem(item: CreateWatchlistItem) {
  db.prepare(
    `INSERT INTO watchlist_items
      (symbol, name, market, category, note, note_path, exchange, currency,
       industries, tags, thesis, article_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(symbol, market) DO UPDATE SET
       name = excluded.name,
       note = excluded.note,
       note_path = excluded.note_path,
       exchange = excluded.exchange,
       currency = excluded.currency,
       industries = excluded.industries,
       tags = excluded.tags,
       thesis = excluded.thesis,
       article_count = excluded.article_count`,
  ).run(
    item.symbol.trim().toUpperCase(),
    item.name.trim(),
    item.market,
    item.category,
    item.note?.trim() ?? "",
    item.notePath ?? "",
    item.exchange ?? "",
    item.currency ?? "",
    JSON.stringify(item.industries ?? []),
    JSON.stringify(item.tags ?? []),
    item.thesis ?? "",
    item.articleCount ?? 0,
  );
}
