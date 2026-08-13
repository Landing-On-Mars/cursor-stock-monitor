import "server-only";

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const INDEX_PATH = ".workbuddy/migration/stocks-index.csv";

export type VaultGitStatus = {
  branch: string;
  managedFiles: string[];
  pendingFiles: string[];
};

function runGit(vaultRoot: string, args: string[]) {
  return execFileSync("git", ["-c", "core.quotepath=false", "-C", vaultRoot, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function assertVaultRepository(vaultRoot: string) {
  if (!fs.existsSync(path.join(vaultRoot, ".git"))) {
    throw new Error("Vault 不是 Git 仓库，无法提交到 GitHub。");
  }
}

function assertManagedPath(vaultRoot: string, relativePath: string) {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (
    normalized.includes("..") ||
    !(normalized === INDEX_PATH || /^Stocks\/(CN|HK|US|Unsupported)\/[^/]+\.md$/.test(normalized))
  ) {
    throw new Error(`不允许提交的 Vault 路径：${relativePath}`);
  }

  const absolute = path.resolve(vaultRoot, normalized);
  const root = path.resolve(vaultRoot) + path.sep;
  if (!absolute.startsWith(root)) {
    throw new Error(`Vault 路径超出范围：${relativePath}`);
  }
  return normalized;
}

function isTierOnlyDiff(vaultRoot: string, relativePath: string) {
  const diff = runGit(vaultRoot, ["diff", "--unified=0", "--", relativePath]);
  const changedLines = diff
    .split(/\r?\n/)
    .filter((line) => /^[+-]/.test(line) && !/^(---|\+\+\+)/.test(line));

  if (relativePath === INDEX_PATH) {
    return (
      changedLines.length > 0 &&
      changedLines.every((line) =>
        /^[+-][^,]+,[^,]+,(US|HK|CN|OTHER),(core|watch|archive),Stocks\/(CN|HK|US|Unsupported)\/.+\.md$/.test(
          line,
        ),
      )
    );
  }

  return (
    changedLines.length === 2 &&
    changedLines.every((line) => /^[+-]tier:\s*(core|watch|archive)$/.test(line))
  );
}

/**
 * Supports local category writes made before a pending-file manifest existed,
 * while refusing to include unrelated Vault changes in a commit.
 */
export function discoverCategorySyncFiles(vaultRoot: string) {
  assertVaultRepository(vaultRoot);
  const changed = runGit(vaultRoot, ["diff", "--name-only"])
    .split(/\r?\n/)
    .filter(Boolean);

  const eligible = changed.filter((file) => {
    try {
      assertManagedPath(vaultRoot, file);
      return isTierOnlyDiff(vaultRoot, file);
    } catch {
      return false;
    }
  });

  return eligible.includes(INDEX_PATH) ? eligible : [];
}

export function getVaultGitStatus(
  vaultRoot: string,
  managedFiles: string[],
): VaultGitStatus {
  assertVaultRepository(vaultRoot);
  const files = [...new Set(managedFiles.map((file) => assertManagedPath(vaultRoot, file)))];
  const branch = runGit(vaultRoot, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const output = files.length
    ? runGit(vaultRoot, ["diff", "--name-only", "--", ...files])
    : "";
  const pendingFiles = output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.trim());

  return { branch, managedFiles: files, pendingFiles };
}

export function commitAndPushVaultFiles(
  vaultRoot: string,
  managedFiles: string[],
) {
  const status = getVaultGitStatus(vaultRoot, managedFiles);
  if (status.pendingFiles.length === 0) {
    throw new Error("没有待提交的 Vault 分组变更。");
  }

  runGit(vaultRoot, ["add", "--", ...status.managedFiles]);

  const staged = runGit(vaultRoot, [
    "diff",
    "--cached",
    "--name-only",
    "--",
    ...status.managedFiles,
  ]);
  if (!staged) {
    throw new Error("没有可提交的 Vault 分组变更。");
  }

  runGit(vaultRoot, [
    "commit",
    "-m",
    "chore: sync watchlist categories from Northstar",
    "--",
    ...status.managedFiles,
  ]);
  runGit(vaultRoot, ["push", "-u", "origin", status.branch]);

  return { ...status, committedFiles: staged.split(/\r?\n/).filter(Boolean) };
}
