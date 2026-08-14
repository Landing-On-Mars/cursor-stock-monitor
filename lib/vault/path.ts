import "server-only";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function candidates(): string[] {
  const fromEnv = process.env.VAULT_PATH?.trim();
  return [
    fromEnv,
    path.resolve(process.cwd(), "../investment-vault"),
    path.resolve(process.cwd(), "../../investment-vault"),
    path.join(os.homedir(), "Documents", "Journal"),
  ].filter((value): value is string => Boolean(value));
}

export function resolveVaultPath(): string | null {
  for (const candidate of candidates()) {
    if (fs.existsSync(path.join(candidate, "Stocks"))) return candidate;
  }
  return null;
}

export function vaultFile(relativePath: string): string | null {
  const root = resolveVaultPath();
  if (!root) return null;

  const resolved = path.resolve(root, relativePath);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  if (!resolved.endsWith(".md") || !fs.existsSync(resolved)) return null;
  return resolved;
}
