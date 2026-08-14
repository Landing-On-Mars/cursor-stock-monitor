import { NextRequest, NextResponse } from "next/server";
import { readArticle } from "@/lib/vault/repository";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const relativePath = request.nextUrl.searchParams.get("path")?.trim();
  if (!relativePath) {
    return NextResponse.json({ error: "缺少文章路径。" }, { status: 400 });
  }

  if (!relativePath.startsWith("Articles/") || relativePath.includes("..")) {
    return NextResponse.json({ error: "文章路径无效。" }, { status: 400 });
  }

  const article = readArticle(relativePath);
  if (!article) {
    return NextResponse.json({ error: "没有找到这篇文章。" }, { status: 404 });
  }

  return NextResponse.json(article);
}
