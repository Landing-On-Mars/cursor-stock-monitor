import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  WATCHLIST_CATEGORIES,
  type WatchlistCategory,
} from "@/lib/watchlist-types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function readId(context: RouteContext) {
  const { id } = await context.params;
  const parsed = Number(id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function PATCH(request: Request, context: RouteContext) {
  const id = await readId(context);
  if (!id) {
    return NextResponse.json({ error: "自选股 ID 无效。" }, { status: 400 });
  }

  let body: { category?: WatchlistCategory };
  try {
    body = (await request.json()) as { category?: WatchlistCategory };
  } catch {
    return NextResponse.json({ error: "请求内容不是有效的 JSON。" }, { status: 400 });
  }

  if (!body.category || !WATCHLIST_CATEGORIES.includes(body.category)) {
    return NextResponse.json({ error: "请选择核心、观察或其他分组。" }, { status: 400 });
  }

  const result = db
    .prepare("UPDATE watchlist_items SET category = ? WHERE id = ?")
    .run(body.category, id);

  if (result.changes === 0) {
    return NextResponse.json({ error: "没有找到该自选股。" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const id = await readId(context);
  if (!id) {
    return NextResponse.json({ error: "自选股 ID 无效。" }, { status: 400 });
  }

  const row = db
    .prepare("SELECT symbol, market FROM watchlist_items WHERE id = ?")
    .get(id) as { symbol: string; market: string } | undefined;
  if (!row) {
    return NextResponse.json({ error: "没有找到该自选股。" }, { status: 404 });
  }

  db.prepare(
    "INSERT OR IGNORE INTO watchlist_dismissed (symbol, market) VALUES (?, ?)",
  ).run(row.symbol, row.market);
  db.prepare("DELETE FROM watchlist_items WHERE id = ?").run(id);

  return new Response(null, { status: 204 });
}
