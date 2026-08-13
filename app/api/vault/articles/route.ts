import { NextRequest, NextResponse } from "next/server";
import { notesRootOrThrow } from "@/lib/notes-root";
import { articlesForSymbol, scanVaultArticles } from "@/lib/vault/articles";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const notesRoot = notesRootOrThrow();
    const symbol = request.nextUrl.searchParams.get("symbol")?.trim();
    const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? "0");
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 0;
    const articles = symbol
      ? articlesForSymbol(notesRoot, symbol)
      : scanVaultArticles(notesRoot);
    return NextResponse.json(limit ? articles.slice(0, limit) : articles);
  } catch (error) {
    const message = error instanceof Error ? error.message : "文章读取失败。";
    const status = message.includes("还没有") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
