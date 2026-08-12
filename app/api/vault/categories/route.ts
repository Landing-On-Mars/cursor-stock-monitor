import { NextResponse } from "next/server";
import {
  previewVaultCategorySync,
  syncVaultCategories,
} from "@/lib/vault/category-sync";
import { resolveVaultPath } from "@/lib/vault/path";
import { listWatchlistItems } from "@/lib/watchlist-store";

export const dynamic = "force-dynamic";

function readVaultRoot() {
  const vaultRoot = resolveVaultPath();
  if (!vaultRoot) {
    throw new Error("未找到 investment-vault，请先在设置中配置 Vault 路径。");
  }
  return vaultRoot;
}

export async function GET() {
  try {
    const vaultRoot = readVaultRoot();
    const changes = previewVaultCategorySync(vaultRoot, listWatchlistItems());
    return NextResponse.json({ vaultPath: vaultRoot, changes });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "无法预览 Vault 同步。" },
      { status: 500 },
    );
  }
}

export async function POST() {
  try {
    const vaultRoot = readVaultRoot();
    const changes = syncVaultCategories(vaultRoot, listWatchlistItems());
    return NextResponse.json({ ok: true, vaultPath: vaultRoot, changes });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Vault 分组同步失败。" },
      { status: 500 },
    );
  }
}
