import { NextRequest, NextResponse } from "next/server";
import { notesRootOrThrow } from "@/lib/notes-root";
import {
  buildObsidianUri,
  readVaultArticle,
  writeVaultArticle,
} from "@/lib/vault/articles";

export const dynamic = "force-dynamic";

function payload(notesRoot: string, articlePath: string) {
  const article = readVaultArticle(notesRoot, articlePath);
  return {
    ...article,
    obsidianUri: buildObsidianUri(notesRoot, article.path),
  };
}

export async function GET(request: NextRequest) {
  const articlePath = request.nextUrl.searchParams.get("path")?.trim();
  if (!articlePath) {
    return NextResponse.json({ error: "请提供文章 path。" }, { status: 400 });
  }

  try {
    return NextResponse.json(payload(notesRootOrThrow(), articlePath));
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取文章失败。";
    const status = message.includes("找不到") || message.includes("还没有") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(request: NextRequest) {
  let body: { path?: string; content?: string };
  try {
    body = (await request.json()) as { path?: string; content?: string };
  } catch {
    return NextResponse.json({ error: "请求内容不是有效的 JSON。" }, { status: 400 });
  }

  const articlePath = body.path?.trim();
  if (!articlePath) {
    return NextResponse.json({ error: "请提供文章 path。" }, { status: 400 });
  }
  if (typeof body.content !== "string") {
    return NextResponse.json({ error: "请提供文章正文。" }, { status: 400 });
  }

  try {
    const notesRoot = notesRootOrThrow();
    writeVaultArticle(notesRoot, articlePath, body.content);
    return NextResponse.json(payload(notesRoot, articlePath));
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存文章失败。";
    const status = message.includes("找不到") || message.includes("还没有") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
