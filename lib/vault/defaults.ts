import path from "node:path";

/** Home machine Google Drive vault. Office uses the same relative folders under that PC's Drive. */
export const HOME_VAULT_PATH = "C:\\Users\\musk\\My Drive\\Northstar\\Vault";

export function defaultVaultCandidates(homeDir: string, cwd = process.cwd()): string[] {
  return [
    path.resolve(cwd, "../investment-vault"),
    path.resolve(cwd, "../../investment-vault"),
    path.join(homeDir, "My Drive", "Northstar", "Vault"),
    path.join(homeDir, "Google Drive", "Northstar", "Vault"),
  ];
}

/** Old local vault. Ignore it even if still saved in local-config or VAULT_PATH. */
export function isRetiredVaultPath(folder: string): boolean {
  const normalized = folder.replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase();
  return /\/documents\/journal$/i.test(normalized);
}
