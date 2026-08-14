import "server-only";

import fs from "node:fs";
import path from "node:path";

export const LOCAL_CONFIG_PATH = path.join(process.cwd(), "data", "local-config.json");

export type LocalConfig = {
  vaultPath?: string;
};

export function readLocalConfig(): LocalConfig {
  try {
    const raw = fs.readFileSync(LOCAL_CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw) as LocalConfig;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function writeLocalConfig(next: LocalConfig) {
  fs.mkdirSync(path.dirname(LOCAL_CONFIG_PATH), { recursive: true });
  const current = readLocalConfig();
  const merged: LocalConfig = { ...current, ...next };
  if (!merged.vaultPath) delete merged.vaultPath;
  fs.writeFileSync(LOCAL_CONFIG_PATH, `${JSON.stringify(merged, null, 2)}\n`);
  return merged;
}

export function normalizeFolderPath(input: string) {
  const trimmed = input.trim().replace(/^["']|["']$/g, "");
  if (!trimmed) return "";
  return path.resolve(trimmed);
}
