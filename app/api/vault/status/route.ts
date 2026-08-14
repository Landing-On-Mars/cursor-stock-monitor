import { NextResponse } from "next/server";
import { normalizeFolderPath, writeLocalConfig } from "@/lib/local-config";
import { isRetiredVaultPath } from "@/lib/vault/defaults";
import { vaultRootError } from "@/lib/vault/path";
import { getVaultStatus, resetVaultCache } from "@/lib/vault/repository";
import { syncWatchlistFromVault } from "@/lib/watchlist-sync";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getVaultStatus());
}

export async function POST(request: Request) {
  let body: { vaultPath?: string };
  try {
    body = (await request.json()) as { vaultPath?: string };
  } catch {
    return NextResponse.json({ error: "请求内容不是有效的 JSON。" }, { status: 400 });
  }

  const vaultPath = normalizeFolderPath(body.vaultPath ?? "");
  if (vaultPath) {
    if (isRetiredVaultPath(vaultPath)) {
      return NextResponse.json(
        { error: "Documents\\Journal 已停用。请改用 Google Drive 里的 Northstar\\Vault。" },
        { status: 400 },
      );
    }
    const error = vaultRootError(vaultPath);
    if (error) return NextResponse.json({ error }, { status: 400 });
  }

  writeLocalConfig({ vaultPath: vaultPath || undefined });
  resetVaultCache();
  syncWatchlistFromVault();
  return NextResponse.json(getVaultStatus());
}
