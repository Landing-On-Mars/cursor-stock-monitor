import "server-only";

import fs from "node:fs";
import path from "node:path";

export const LOCAL_CONFIG_PATH = path.join(
  process.cwd(),
  "data",
  "local-config.json",
);
export const DATABASE_FILENAME = "dashboard.db";

export type LocalConfig = {
  databaseDir?: string;
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
  if (!merged.databaseDir) delete merged.databaseDir;
  fs.writeFileSync(LOCAL_CONFIG_PATH, `${JSON.stringify(merged, null, 2)}\n`);
  return merged;
}

export function defaultDatabaseDir() {
  return path.join(process.cwd(), "data");
}

export function defaultDatabasePath() {
  return path.join(defaultDatabaseDir(), DATABASE_FILENAME);
}

/** Accept a folder, or a path that already ends with the db filename. */
export function normalizeDatabaseDir(input: string) {
  const trimmed = input.trim().replace(/^["']|["']$/g, "");
  if (!trimmed) return "";
  const resolved = path.resolve(trimmed);
  if (path.basename(resolved).toLowerCase() === DATABASE_FILENAME) {
    return path.dirname(resolved);
  }
  return resolved;
}
