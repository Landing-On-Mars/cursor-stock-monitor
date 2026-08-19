import { NextRequest, NextResponse } from "next/server";
import { MARKETS, type Market } from "@/lib/watchlist-types";
import { removeStockFocusNote, updateStockFocusNote } from "@/lib/vault/repository";
import { focusNoteId } from "@/lib/vault/focus-notes";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const symbol = request.nextUrl.searchParams.get("symbol")?.trim();
  const market = request.nextUrl.searchParams.get("market")?.trim().toUpperCase();

  if (!id) {
    return NextResponse.json({ error: "记录 ID 无效。" }, { status: 400 });
  }
  if (!symbol || !market || !MARKETS.includes(market as Market)) {
    return NextResponse.json({ error: "请提供有效的股票代码和市场。" }, { status: 400 });
  }

  let payload: { notedAt?: string; body?: string };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "请求内容不是有效的 JSON。" }, { status: 400 });
  }

  const notedAt = payload.notedAt?.trim();
  const text = payload.body?.trim();
  if (!notedAt || !text) {
    return NextResponse.json({ error: "请填写日期和内容。" }, { status: 400 });
  }

  try {
    const notes = updateStockFocusNote(symbol, market, decodeURIComponent(id), notedAt, text);
    const nextId = focusNoteId(notedAt, text);
    const updated = notes.find((note) => note.id === nextId);
    if (!updated) {
      return NextResponse.json({ error: "保存日志失败。" }, { status: 500 });
    }
    return NextResponse.json({
      id: updated.id,
      symbol,
      market,
      notedAt: updated.notedAt,
      body: updated.body,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存日志失败。";
    const status = message.includes("没有找到") || message.includes("还没有") || message.includes("找不到") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

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
