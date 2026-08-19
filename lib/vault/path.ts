import "server-only";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readLocalConfig } from "@/lib/local-config";
import { defaultVaultCandidates, isRetiredVaultPath } from "./defaults";
import { isVaultArticleAssetPath, normalizeVaultRelative } from "./article-media";

export type VaultSource = "env" | "saved" | "auto" | null;

function isVaultRoot(candidate: string) {
  return fs.existsSync(/* turbopackIgnore: true */ path.join(candidate, "Stocks"));
}

export function configuredVaultPath() {
  const fromEnv = process.env.VAULT_PATH?.trim();
  if (fromEnv && !isRetiredVaultPath(fromEnv)) {
    return { path: path.resolve(fromEnv), source: "env" as const };
  }

  const saved = readLocalConfig().vaultPath?.trim();
  if (saved && !isRetiredVaultPath(saved)) {
    return { path: path.resolve(saved), source: "saved" as const };
  }

  return null;
}

function autoCandidates() {
  return defaultVaultCandidates(os.homedir());
}

export function resolveVaultPath(): string | null {
  const configured = configuredVaultPath();
  if (configured) return isVaultRoot(configured.path) ? configured.path : null;

  for (const candidate of autoCandidates()) {
    if (isVaultRoot(candidate)) return candidate;
  }
  return null;
}

export function vaultRootError(folder: string) {
  if (!fs.existsSync(/* turbopackIgnore: true */ folder)) {
    return "这个路径不存在。";
  }
  if (!isVaultRoot(folder)) {
    return "这个文件夹里没有 Stocks。请选 Vault 根目录（里面应有 Stocks、Articles）。";
  }
  return null;
}

export function describeVaultPath() {
  const configured = configuredVaultPath();
  const resolved = resolveVaultPath();
  return {
    savedPath: readLocalConfig().vaultPath ?? "",
    resolvedPath: resolved,
    source: configured ? configured.source : resolved ? ("auto" as const) : null,
    ok: Boolean(resolved),
  };
}

export function vaultFile(relativePath: string): string | null {
  return vaultResolve(relativePath, (relative) => relative.endsWith(".md"));
}

export function vaultArticleAsset(relativePath: string): string | null {
  return vaultResolve(relativePath, (relative) => isVaultArticleAssetPath(relative));
}

function vaultResolve(relativePath: string, allowed: (relative: string) => boolean): string | null {
  const root = resolveVaultPath();
  if (!root) return null;

  const resolved = path.resolve(root, relativePath);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  const normalized = normalizeVaultRelative(relative);
  if (!allowed(normalized)) return null;
  if (!fs.existsSync(/* turbopackIgnore: true */ resolved)) return null;
  return resolved;
}
