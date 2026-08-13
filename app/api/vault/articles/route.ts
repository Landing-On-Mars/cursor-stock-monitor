import { NextRequest, NextResponse } from "next/server";
import { notesRootOrThrow } from "@/lib/notes-root";
import {
  articlesForSymbol,
  createVaultArticle,
  scanVaultArticles,
} from "@/lib/vault/articles";

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

export async function POST(request: Request) {
  let body: {
    title?: string;
    date?: string;
    content?: string;
    symbols?: string[];
    source?: string;
  };
  try {
    body = (await request.json()) as {
      title?: string;
      date?: string;
      content?: string;
      symbols?: string[];
      source?: string;
    };
  } catch {
    return NextResponse.json({ error: "请求内容不是有效的 JSON。" }, { status: 400 });
  }

  const title = body.title?.trim();
  if (!title) {
    return NextResponse.json({ error: "请填写标题。" }, { status: 400 });
  }
  if (typeof body.content !== "string") {
    return NextResponse.json({ error: "请填写正文。" }, { status: 400 });
  }

  const symbols = Array.isArray(body.symbols)
    ? body.symbols.map((symbol) => String(symbol))
    : [];

  try {
    const article = createVaultArticle(notesRootOrThrow(), {
      title,
      date: body.date?.trim() || new Date().toISOString().slice(0, 10),
      body: body.content,
      symbols,
      source: body.source,
    });
    return NextResponse.json(article, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建笔记失败。";
    const status = message.includes("还没有") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
