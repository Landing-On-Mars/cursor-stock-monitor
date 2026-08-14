import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { MARKETS, type Market } from "@/lib/watchlist-types";

export const dynamic = "force-dynamic";

export type FocusNote = {
  id: number;
  symbol: string;
  market: Market;
  notedAt: string;
  body: string;
  createdAt: string;
};

type FocusRow = {
  id: number;
  symbol: string;
  market: Market;
  noted_at: string;
  body: string;
  created_at: string;
};

function toNote(row: FocusRow): FocusNote {
  return {
    id: row.id,
    symbol: row.symbol,
    market: row.market,
    notedAt: row.noted_at,
    body: row.body,
    createdAt: row.created_at,
  };
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.trim();
  const market = request.nextUrl.searchParams.get("market")?.trim().toUpperCase();
  if (!symbol || !market || !MARKETS.includes(market as Market)) {
    return NextResponse.json({ error: "请提供有效的股票代码和市场。" }, { status: 400 });
  }

  const rows = db
    .prepare(
      `SELECT id, symbol, market, noted_at, body, created_at
       FROM focus_notes
       WHERE symbol = ? AND market = ?
       ORDER BY noted_at DESC, id DESC`,
    )
    .all(symbol, market) as FocusRow[];

  return NextResponse.json(rows.map(toNote));
}

export async function POST(request: Request) {
  let body: { symbol?: string; market?: string; notedAt?: string; body?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "请求内容不是有效的 JSON。" }, { status: 400 });
  }

  const symbol = body.symbol?.trim().toUpperCase();
  const market = body.market?.trim().toUpperCase();
  const notedAt = body.notedAt?.trim();
  const text = body.body?.trim();

  if (!symbol || !market || !MARKETS.includes(market as Market)) {
    return NextResponse.json({ error: "请提供有效的股票代码和市场。" }, { status: 400 });
  }
  if (!notedAt || !text) {
    return NextResponse.json({ error: "请填写日期和内容。" }, { status: 400 });
  }

  const result = db
    .prepare(
      `INSERT INTO focus_notes (symbol, market, noted_at, body)
       VALUES (?, ?, ?, ?)`,
    )
    .run(symbol, market, notedAt, text);

  const row = db
    .prepare(
      `SELECT id, symbol, market, noted_at, body, created_at
       FROM focus_notes WHERE id = ?`,
    )
    .get(result.lastInsertRowid) as FocusRow;

  return NextResponse.json(toNote(row), { status: 201 });
}
