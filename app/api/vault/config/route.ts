import { NextResponse } from "next/server";
import {
  resolveVaultPath,
  setConfiguredVaultPath,
  vaultStatus,
} from "@/lib/vault/path";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(vaultStatus());
}

export async function POST(request: Request) {
  let body: { path?: string };
  try {
    body = (await request.json()) as { path?: string };
  } catch {
    return NextResponse.json({ error: "请求内容不是有效的 JSON。" }, { status: 400 });
  }

  const vaultPath = body.path?.trim();
  if (!vaultPath) {
    return NextResponse.json({ error: "请提供 Vault 路径。" }, { status: 400 });
  }

  const resolved = resolveVaultPath(vaultPath);
  if (!resolved) {
    return NextResponse.json(
      { error: "路径无效：需要包含 Stocks 与 Articles 目录。" },
      { status: 400 },
    );
  }

  setConfiguredVaultPath(resolved);
  return NextResponse.json(vaultStatus());
}
