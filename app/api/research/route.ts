import { NextRequest, NextResponse } from "next/server";
import { MARKETS, type Market } from "@/lib/watchlist-types";
import {
  cursorPrompt,
  findStock,
  getVaultStatus,
  relatedArticles,
  updateStockThesis,
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
      cursorPrompt: "",
    });
  }

  return NextResponse.json({
    found: true,
    vault: status,
    stock,
    articles: relatedArticles(symbol, market),
    cursorPrompt: cursorPrompt(stock),
  });
}

export async function PUT(request: Request) {
  let body: { symbol?: string; market?: string; thesis?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "请求内容不是有效的 JSON。" }, { status: 400 });
  }

  const symbol = body.symbol?.trim().toUpperCase();
  const market = body.market?.trim().toUpperCase();
  const thesis = body.thesis?.replace(/\r\n/g, "\n").trim();

  if (!symbol || !market || !MARKETS.includes(market as Market)) {
    return NextResponse.json({ error: "请提供有效的股票代码和市场。" }, { status: 400 });
  }
  if (!thesis) {
    return NextResponse.json({ error: "请填写投资逻辑。" }, { status: 400 });
  }

  try {
    const stock = updateStockThesis(symbol, market, thesis);
    if (!stock) {
      return NextResponse.json({ error: "Vault 里还没有这只股票的档案。" }, { status: 404 });
    }
    return NextResponse.json({
      found: true,
      vault: getVaultStatus(),
      stock,
      articles: relatedArticles(symbol, market),
      cursorPrompt: cursorPrompt(stock),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存投资逻辑失败。";
    const status = message.includes("还没有") || message.includes("找不到") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
