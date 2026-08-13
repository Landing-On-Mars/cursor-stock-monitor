import { NextRequest, NextResponse } from "next/server";
import { readStoreAsset } from "@/lib/store-assets";
import { readVaultAsset } from "@/lib/vault/assets";
import { resolveVaultPath } from "@/lib/vault/path";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const assetPath = request.nextUrl.searchParams.get("path")?.trim();
  if (!assetPath) {
    return NextResponse.json({ error: "请提供资源 path。" }, { status: 400 });
  }

  try {
    const normalized = assetPath.replace(/\\/g, "/");
    const asset = normalized.startsWith("assets/")
      ? readStoreAsset(normalized)
      : (() => {
          const vaultRoot = resolveVaultPath();
          if (!vaultRoot) {
            throw new Error(`找不到图片：${normalized}`);
          }
          return readVaultAsset(vaultRoot, normalized);
        })();
    return new NextResponse(asset.buffer, {
      headers: {
        "Content-Type": asset.mimeType,
        "Cache-Control": "public, max-age=3600",
        "Content-Length": String(asset.buffer.byteLength),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取图片失败。";
    const status = message.includes("找不到") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
