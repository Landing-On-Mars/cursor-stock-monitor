import { NextRequest, NextResponse } from "next/server";
import { getStoredArticle } from "@/lib/store-articles";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const articlePath = request.nextUrl.searchParams.get("path")?.trim();
  if (!articlePath) {
    return NextResponse.json({ error: "请提供文章 path。" }, { status: 400 });
  }

  try {
    const article = getStoredArticle(articlePath);
    return NextResponse.json(article);
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取文章失败。";
    const status = message.includes("找不到") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
