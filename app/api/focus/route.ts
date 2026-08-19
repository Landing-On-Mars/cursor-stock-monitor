import { NextRequest, NextResponse } from "next/server";
import { MARKETS, type Market } from "@/lib/watchlist-types";
import {
  addStockFocusNote,
  listStockFocusNotes,
} from "@/lib/vault/repository";

export const dynamic = "force-dynamic";

export type FocusNote = {
  id: string;
  symbol: string;
  market: Market;
  notedAt: string;
  body: string;
};

function withStock(symbol: string, market: Market, notedAt: string, body: string, id: string): FocusNote {
  return { id, symbol, market, notedAt, body };
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.trim();
  const market = request.nextUrl.searchParams.get("market")?.trim().toUpperCase();
  if (!symbol || !market || !MARKETS.includes(market as Market)) {
    return NextResponse.json({ error: "请提供有效的股票代码和市场。" }, { status: 400 });
  }

  const notes = listStockFocusNotes(symbol, market).map((note) =>
    withStock(symbol, market as Market, note.notedAt, note.body, note.id),
  );
  return NextResponse.json(notes);
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

  try {
    const notes = addStockFocusNote(symbol, market, notedAt, text);
    const created = notes[0];
    return NextResponse.json(
      withStock(symbol, market as Market, created.notedAt, created.body, created.id),
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存观察失败。";
    const status = message.includes("还没有") || message.includes("找不到") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
