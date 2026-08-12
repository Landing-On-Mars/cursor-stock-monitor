import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  commitAndPushVaultFiles,
  discoverCategorySyncFiles,
  getVaultGitStatus,
} from "@/lib/vault/git";
import { resolveVaultPath } from "@/lib/vault/path";

export const dynamic = "force-dynamic";

const PENDING_CATEGORY_FILES_KEY = "vault_pending_category_files";

function readVaultRoot() {
  const vaultRoot = resolveVaultPath();
  if (!vaultRoot) {
    throw new Error("未找到 investment-vault，请先在设置中配置 Vault 路径。");
  }
  return vaultRoot;
}

function readManagedFiles() {
  const row = db
    .prepare("SELECT value FROM app_meta WHERE key = ?")
    .get(PENDING_CATEGORY_FILES_KEY) as { value: string } | undefined;

  if (!row?.value) return [];
  try {
    const parsed = JSON.parse(row.value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const vaultRoot = readVaultRoot();
    const managedFiles = readManagedFiles();
    const status = getVaultGitStatus(
      vaultRoot,
      managedFiles.length > 0 ? managedFiles : discoverCategorySyncFiles(vaultRoot),
    );
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "无法读取 Vault Git 状态。" },
      { status: 500 },
    );
  }
}

export async function POST() {
  try {
    const vaultRoot = readVaultRoot();
    const managedFiles = readManagedFiles();
    const result = commitAndPushVaultFiles(
      vaultRoot,
      managedFiles.length > 0 ? managedFiles : discoverCategorySyncFiles(vaultRoot),
    );
    db.prepare("DELETE FROM app_meta WHERE key = ?").run(PENDING_CATEGORY_FILES_KEY);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Vault 提交或推送失败。" },
      { status: 500 },
    );
  }
}
