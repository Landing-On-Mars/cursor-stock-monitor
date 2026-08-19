import { NextRequest, NextResponse } from "next/server";
import { isVaultArticlePath } from "@/lib/vault/article-path";
import { readArticle } from "@/lib/vault/repository";

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
