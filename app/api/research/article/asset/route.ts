import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { isVaultArticlePath } from "@/lib/vault/article-path";
import { resolveArticleAsset } from "@/lib/vault/repository";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
};

export async function GET(request: NextRequest) {
  const articlePath = request.nextUrl.searchParams.get("article")?.trim().replaceAll("\\", "/");
  const src = request.nextUrl.searchParams.get("src")?.trim();
  if (!articlePath || !src) {
    return NextResponse.json({ error: "缺少文章或图片路径。" }, { status: 400 });
  }
  if (!isVaultArticlePath(articlePath)) {
    return NextResponse.json({ error: "文章路径无效。" }, { status: 400 });
  }

  const absolute = resolveArticleAsset(articlePath, src);
  if (!absolute) {
    return NextResponse.json({ error: "没有找到这张图片。" }, { status: 404 });
  }

  const ext = path.extname(absolute).toLowerCase();
  const type = TYPES[ext];
  if (!type) {
    return NextResponse.json({ error: "不支持的图片格式。" }, { status: 400 });
  }

  const data = fs.readFileSync(/* turbopackIgnore: true */ absolute);
  return new NextResponse(data, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
