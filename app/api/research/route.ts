import { NextRequest, NextResponse } from "next/server";
import { MARKETS, type Market } from "@/lib/watchlist-types";
import {
  cursorPrompt,
  findPeers,
  findStock,
  getVaultStatus,
  relatedArticles,
} from "@/lib/vault/repository";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.trim();
  const market = request.nextUrl.searchParams.get("market")?.trim().toUpperCase();
  const status = getVaultStatus();

  if (!symbol || !market || !MARKETS.includes(market as Market)) {
    return NextResponse.json({ error: "请提供有效的股票代码和市场。" }, { status: 400 });
  }

  if (!status.ok) {
    return NextResponse.json({
      found: false,
      vault: status,
      stock: null,
      articles: [],
      peers: [],
      cursorPrompt: "",
    });
  }

  const stock = findStock(symbol, market);
  if (!stock) {
    return NextResponse.json({
      found: false,
      vault: status,
      stock: null,
      articles: [],
      peers: [],
      cursorPrompt: "",
    });
  }

  return NextResponse.json({
    found: true,
    vault: status,
    stock,
    articles: relatedArticles(symbol, market),
    peers: findPeers(stock),
    cursorPrompt: cursorPrompt(stock),
  });
}
