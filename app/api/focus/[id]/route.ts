import { NextRequest, NextResponse } from "next/server";
import { MARKETS, type Market } from "@/lib/watchlist-types";
import { removeStockFocusNote } from "@/lib/vault/repository";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const symbol = request.nextUrl.searchParams.get("symbol")?.trim();
  const market = request.nextUrl.searchParams.get("market")?.trim().toUpperCase();

  if (!id) {
    return NextResponse.json({ error: "记录 ID 无效。" }, { status: 400 });
  }
  if (!symbol || !market || !MARKETS.includes(market as Market)) {
    return NextResponse.json({ error: "请提供有效的股票代码和市场。" }, { status: 400 });
  }

  try {
    removeStockFocusNote(symbol, market, decodeURIComponent(id));
    return new Response(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除失败。";
    const status = message.includes("没有找到") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
