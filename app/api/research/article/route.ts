import { NextRequest, NextResponse } from "next/server";
import { isVaultArticlePath } from "@/lib/vault/article-path";
import { readArticle, writeArticle } from "@/lib/vault/repository";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const relativePath = request.nextUrl.searchParams.get("path")?.trim().replaceAll("\\", "/");
  if (!relativePath) {
    return NextResponse.json({ error: "缺少文章路径。" }, { status: 400 });
  }

  if (!isVaultArticlePath(relativePath)) {
    return NextResponse.json({ error: "文章路径无效。" }, { status: 400 });
  }

  const article = readArticle(relativePath);
  if (!article) {
    return NextResponse.json({ error: "没有找到这篇文章。" }, { status: 404 });
  }

  return NextResponse.json(article);
}

export async function PUT(request: NextRequest) {
  let payload: { path?: string; content?: string; source?: string };
  try {
    payload = (await request.json()) as {
      path?: string;
      content?: string;
      source?: string;
    };
  } catch {
    return NextResponse.json({ error: "请求内容不是有效的 JSON。" }, { status: 400 });
  }

  const relativePath = payload.path?.trim().replaceAll("\\", "/");
  if (!relativePath) {
    return NextResponse.json({ error: "缺少文章路径。" }, { status: 400 });
  }
  if (!isVaultArticlePath(relativePath)) {
    return NextResponse.json({ error: "文章路径无效。" }, { status: 400 });
  }
  if (typeof payload.content !== "string") {
    return NextResponse.json({ error: "请提供文章正文。" }, { status: 400 });
  }

  try {
    const article = writeArticle(
      relativePath,
      payload.content,
      typeof payload.source === "string" ? { source: payload.source } : undefined,
    );
    return NextResponse.json(article);
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存文章失败。";
    const status = message.includes("找不到") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
