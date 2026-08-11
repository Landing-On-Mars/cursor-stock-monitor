import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";

const META_KEY = "vault_path";

const candidateRoots = [
  process.env.VAULT_PATH,
  path.resolve(process.cwd(), "..", "investment-vault"),
  path.resolve(process.cwd(), "../../investment-vault"),
  "/agent/repos/investment-vault",
].filter((value): value is string => Boolean(value));

export function getConfiguredVaultPath() {
  const row = db
    .prepare("SELECT value FROM app_meta WHERE key = ?")
    .get(META_KEY) as { value: string } | undefined;
  return row?.value?.trim() || "";
}

export function setConfiguredVaultPath(vaultPath: string) {
  const normalized = path.resolve(vaultPath.trim());
  db.prepare(
    `INSERT INTO app_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(META_KEY, normalized);
  return normalized;
}

export function resolveVaultPath(override?: string) {
  const configured = override?.trim() || getConfiguredVaultPath();
  const candidates = configured ? [configured, ...candidateRoots] : candidateRoots;

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (
      fs.existsSync(path.join(resolved, "Stocks")) &&
      fs.existsSync(path.join(resolved, "Articles"))
    ) {
      return resolved;
    }
  }

  return null;
}

export function vaultStatus() {
  const configured = getConfiguredVaultPath();
  const resolved = resolveVaultPath();
  return {
    configured: configured || null,
    resolved,
    available: Boolean(resolved),
    stocksIndex: resolved
      ? path.join(resolved, ".workbuddy/migration/stocks-index.csv")
      : null,
  };
}
