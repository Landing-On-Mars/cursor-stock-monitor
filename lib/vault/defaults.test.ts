import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { defaultVaultCandidates, HOME_VAULT_PATH, isRetiredVaultPath } from "./defaults";

test("auto-detects Google Drive Northstar Vault and never Documents/Journal", () => {
  const home = path.join("C:", "Users", "musk");
  const candidates = defaultVaultCandidates(home, path.join("C:", "Users", "musk", "cursor-stock-monitor"));
  const normalized = candidates.map((candidate) => candidate.replaceAll("\\", "/"));
  assert.ok(normalized.some((candidate) => candidate.endsWith("/My Drive/Northstar/Vault")));
  assert.ok(normalized.some((candidate) => candidate.endsWith("/Google Drive/Northstar/Vault")));
  assert.equal(
    normalized.some((candidate) => candidate.includes("/Documents/Journal")),
    false,
  );
  assert.ok(HOME_VAULT_PATH.replaceAll("\\", "/").endsWith("/My Drive/Northstar/Vault"));
  assert.equal(isRetiredVaultPath("C:\\Users\\musk\\Documents\\Journal"), true);
  assert.equal(isRetiredVaultPath("C:\\Users\\musk\\My Drive\\Northstar\\Vault"), false);
});

test("keeps the sibling investment-vault checkout for this repo", () => {
  const cwd = path.join(os.tmpdir(), "cursor-stock-monitor");
  const candidates = defaultVaultCandidates(os.homedir(), cwd);
  assert.ok(candidates.some((candidate) => candidate.endsWith(`${path.sep}investment-vault`)));
});
