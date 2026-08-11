import { NextRequest, NextResponse } from "next/server";
import {
  articlesForSymbol,
  scanVaultArticles,
} from "@/lib/vault/articles";
import { resolveVaultPath } from "@/lib/vault/path";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const vaultRoot = resolveVaultPath();
  if (!vaultRoot) {
    return NextResponse.json(
      { error: "未找到 investment-vault。" },
      { status: 404 },
    );
  }

  const symbol = request.nextUrl.searchParams.get("symbol")?.trim();
  const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? "0");
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 0;

  try {
    const articles = symbol
      ? articlesForSymbol(vaultRoot, symbol)
      : scanVaultArticles(vaultRoot);

    return NextResponse.json(limit ? articles.slice(0, limit) : articles);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "文章扫描失败。" },
      { status: 500 },
    );
  }
}
