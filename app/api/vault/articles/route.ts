import { NextRequest, NextResponse } from "next/server";
import { listStoredArticles } from "@/lib/store-articles";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.trim();
  const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? "0");
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 0;

  try {
    const articles = listStoredArticles(symbol || undefined);
    return NextResponse.json(limit ? articles.slice(0, limit) : articles);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "文章读取失败。" },
      { status: 500 },
    );
  }
}
