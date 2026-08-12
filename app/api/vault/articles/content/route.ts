import { NextRequest, NextResponse } from "next/server";
import { buildObsidianUri, readVaultArticle } from "@/lib/vault/articles";
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

  const articlePath = request.nextUrl.searchParams.get("path")?.trim();
  if (!articlePath) {
    return NextResponse.json({ error: "请提供文章 path。" }, { status: 400 });
  }

  try {
    const article = readVaultArticle(vaultRoot, articlePath);
    return NextResponse.json({
      ...article,
      obsidianUri: buildObsidianUri(vaultRoot, article.path),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取文章失败。";
    const status = message.includes("找不到") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
