import { NextResponse } from "next/server";
import {
  insertWatchlistItem,
  listWatchlistItems,
} from "@/lib/watchlist-store";
import {
  MARKETS,
  WATCHLIST_CATEGORIES,
  type CreateWatchlistItem,
} from "@/lib/watchlist-types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(listWatchlistItems());
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
    return NextResponse.json({ error: "请选择核心、观察或归档分组。" }, { status: 400 });
  }

  try {
    const item = insertWatchlistItem({
      symbol,
      name,
      market: body.market,
      category: body.category,
      note,
      notePath: body.notePath,
      exchange: body.exchange,
      currency: body.currency,
      industries: body.industries,
      tags: body.tags,
      thesis: body.thesis,
      articleCount: body.articleCount,
    });

    return NextResponse.json(item, { status: 201 });
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
