import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  MARKETS,
  WATCHLIST_CATEGORIES,
  type CreateWatchlistItem,
  type Market,
  type WatchlistCategory,
  type WatchlistItem,
} from "@/lib/watchlist-types";

export const dynamic = "force-dynamic";

type WatchlistRow = {
  id: number;
  symbol: string;
  name: string;
  market: Market;
  category: WatchlistCategory;
  note: string;
  created_at: string;
};

function toWatchlistItem(row: WatchlistRow): WatchlistItem {
  return {
    id: row.id,
    symbol: row.symbol,
    name: row.name,
    market: row.market,
    category: row.category,
    note: row.note,
    createdAt: row.created_at,
  };
}

export async function GET() {
  const rows = db
    .prepare(
      `SELECT id, symbol, name, market, category, note, created_at
       FROM watchlist_items
       ORDER BY category ASC, created_at ASC`,
    )
    .all() as WatchlistRow[];

  return NextResponse.json(rows.map(toWatchlistItem));
}

export async function POST(request: Request) {
  let body: Partial<CreateWatchlistItem>;

  try {
    body = (await request.json()) as Partial<CreateWatchlistItem>;
  } catch {
    return NextResponse.json({ error: "请求内容不是有效的 JSON。" }, { status: 400 });
  }

  const symbol = body.symbol?.trim().toUpperCase();
  const name = body.name?.trim();
  const note = body.note?.trim() ?? "";

  if (!symbol || !name) {
    return NextResponse.json({ error: "股票代码和名称不能为空。" }, { status: 400 });
  }

  if (!body.market || !MARKETS.includes(body.market)) {
    return NextResponse.json({ error: "请选择有效市场。" }, { status: 400 });
  }

  if (!body.category || !WATCHLIST_CATEGORIES.includes(body.category)) {
    return NextResponse.json({ error: "请选择核心或观察分组。" }, { status: 400 });
  }

  try {
    const result = db
      .prepare(
        `INSERT INTO watchlist_items (symbol, name, market, category, note)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(symbol, name, body.market, body.category, note);

    const row = db
      .prepare(
        `SELECT id, symbol, name, market, category, note, created_at
         FROM watchlist_items WHERE id = ?`,
      )
      .get(result.lastInsertRowid) as WatchlistRow;

    return NextResponse.json(toWatchlistItem(row), { status: 201 });
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "SQLITE_CONSTRAINT_UNIQUE"
    ) {
      return NextResponse.json(
        { error: `${symbol} 已经在自选股中。` },
        { status: 409 },
      );
    }

    throw error;
  }
}
