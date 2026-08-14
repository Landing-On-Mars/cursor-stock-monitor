import { NextRequest, NextResponse } from "next/server";
import { MARKETS, type Market } from "@/lib/watchlist-types";
import { emptySnapshot, loadQuote } from "@/lib/marketdata/load-quote";
import { toYahooSymbol } from "@/lib/vault/symbols";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return NextResponse.json(emptySnapshot("", ""));
  }

  const symbol = request.nextUrl.searchParams.get("symbol")?.trim();
  const market = request.nextUrl.searchParams.get("market")?.trim().toUpperCase();
  const range = request.nextUrl.searchParams.get("range")?.trim() || "6mo";

  if (!symbol || !market || !MARKETS.includes(market as Market)) {
    return NextResponse.json({ error: "请提供有效的股票代码和市场。" }, { status: 400 });
  }

  try {
    return NextResponse.json(await loadQuote(symbol, market, range));
  } catch (error) {
    console.error("Quote GET failed:", error);
    return NextResponse.json(emptySnapshot(toYahooSymbol(symbol, market), "行情暂时不可用。"));
  }
}
