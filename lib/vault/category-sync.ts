import "server-only";

import fs from "node:fs";
import path from "node:path";
import { parseFrontmatter, asString } from "@/lib/vault/frontmatter";
import type { WatchlistItem, WatchlistCategory } from "@/lib/watchlist-types";

export type VaultCategoryChange = {
  id: number;
  symbol: string;
  name: string;
  notePath: string;
  dashboardTier: string;
  vaultTier: string;
};

function toVaultTier(category: WatchlistCategory) {
  if (category === "CORE") return "core";
  if (category === "ARCHIVE") return "archive";
  return "watch";
}

function assertStockNotePath(notePath: string) {
  const normalized = notePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (
    !/^Stocks\/(CN|HK|US|Unsupported)\/[^/]+\.md$/.test(normalized) ||
    normalized.includes("..")
  ) {
    throw new Error(`不是可同步的股票笔记路径：${notePath}`);
  }
  return normalized;
}

function readCurrentTier(vaultRoot: string, notePath: string) {
  const safePath = assertStockNotePath(notePath);
  const absolutePath = path.resolve(vaultRoot, safePath);
  const stocksRoot = path.resolve(vaultRoot, "Stocks") + path.sep;

  if (!absolutePath.startsWith(stocksRoot) || !fs.existsSync(absolutePath)) {
    throw new Error(`找不到股票笔记：${safePath}`);
  }

  const source = fs.readFileSync(absolutePath, "utf8");
  const { data } = parseFrontmatter(source);
  return asString(data.tier).toLowerCase();
}

export function previewVaultCategorySync(
  vaultRoot: string,
  items: WatchlistItem[],
) {
  const changes: VaultCategoryChange[] = [];

  for (const item of items) {
    if (!item.notePath) continue;
    const dashboardTier = toVaultTier(item.category);
    const vaultTier = readCurrentTier(vaultRoot, item.notePath);
    if (dashboardTier !== vaultTier) {
      changes.push({
        id: item.id,
        symbol: item.symbol,
        name: item.name,
        notePath: item.notePath,
        dashboardTier,
        vaultTier,
      });
    }
  }

  return changes;
}

function writeTierToStockNote(
  vaultRoot: string,
  notePath: string,
  nextTier: string,
) {
  const safePath = assertStockNotePath(notePath);
  const absolutePath = path.resolve(vaultRoot, safePath);
  const source = fs.readFileSync(absolutePath, "utf8");

  if (!/^tier:\s*.*$/m.test(source)) {
    throw new Error(`股票笔记缺少 tier 字段：${safePath}`);
  }

  fs.writeFileSync(
    absolutePath,
    source.replace(/^tier:\s*.*$/m, `tier: ${nextTier}`),
    "utf8",
  );
}

function updateStocksIndex(vaultRoot: string, changes: VaultCategoryChange[]) {
  const indexPath = path.join(vaultRoot, ".workbuddy/migration/stocks-index.csv");
  if (!fs.existsSync(indexPath)) {
    throw new Error("找不到 stocks-index.csv，已停止同步。");
  }

  const updates = new Map(changes.map((change) => [change.notePath, change.dashboardTier]));
  const source = fs.readFileSync(indexPath, "utf8");
  const hasBom = source.startsWith("\uFEFF");
  const lines = source.replace(/^\uFEFF/, "").split(/\r?\n/);
  const header = lines[0]?.split(",") ?? [];
  const tierIndex = header.indexOf("tier");
  const pathIndex = header.indexOf("note_path");

  if (tierIndex < 0 || pathIndex < 0) {
    throw new Error("stocks-index.csv 缺少 tier 或 note_path 列。");
  }

  const nextLines = lines.map((line, index) => {
    if (index === 0 || !line) return line;
    const cells = line.split(",");
    const nextTier = updates.get(cells[pathIndex]);
    if (!nextTier) return line;
    cells[tierIndex] = nextTier;
    return cells.join(",");
  });

  fs.writeFileSync(indexPath, `${hasBom ? "\uFEFF" : ""}${nextLines.join("\n")}`, "utf8");
}

export function syncVaultCategories(
  vaultRoot: string,
  items: WatchlistItem[],
) {
  const changes = previewVaultCategorySync(vaultRoot, items);
  if (changes.length === 0) return changes;

  for (const change of changes) {
    writeTierToStockNote(vaultRoot, change.notePath, change.dashboardTier);
  }
  updateStocksIndex(vaultRoot, changes);

  return changes;
}
