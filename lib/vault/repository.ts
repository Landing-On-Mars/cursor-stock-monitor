import "server-only";

import fs from "node:fs";
import path from "node:path";
import { parseArticleMarkdown, type ParsedArticle } from "./parse-article";
import { parseStockMarkdown } from "./parse-stock";
import { resolveVaultPath, vaultFile } from "./path";
import { articleMentionsStock, symbolKey } from "./symbols";
import type { ArticleSummary, PeerStock, StockCockpit } from "./types";

export type VaultStatus = {
  ok: boolean;
  path: string | null;
  stockCount: number;
  articleCount: number;
};

type StockRecord = {
  relativePath: string;
  cockpit: StockCockpit;
};

let cachedRoot: string | null | undefined;
let stockIndex: Map<string, StockRecord> | null = null;
let articleIndex: ParsedArticle[] | null = null;

export function getVaultStatus(): VaultStatus {
  const root = resolveVaultPath();
  if (!root) return { ok: false, path: null, stockCount: 0, articleCount: 0 };
  loadIndexes(root);
  return {
    ok: true,
    path: root,
    stockCount: stockIndex?.size ?? 0,
    articleCount: articleIndex?.length ?? 0,
  };
}

export function findStock(symbol: string, market: string): StockCockpit | null {
  const root = resolveVaultPath();
  if (!root) return null;
  loadIndexes(root);
  return stockIndex?.get(symbolKey(symbol, market))?.cockpit ?? null;
}

export function relatedArticles(symbol: string, market: string, limit = 8): ArticleSummary[] {
  const root = resolveVaultPath();
  if (!root) return [];
  loadIndexes(root);

  return (articleIndex ?? [])
    .filter((article) => articleMentionsStock(article.symbols, symbol, market))
    .sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""))
    .slice(0, limit)
    .map((article) => ({
      path: article.path,
      title: article.title,
      source: article.source,
      publishedAt: article.publishedAt,
      status: article.status,
      summary: article.summary,
    }));
}

export function findPeers(stock: StockCockpit, limit = 5): PeerStock[] {
  const industry = stock.industries[0];
  if (!industry || !stockIndex) return [];

  return [...stockIndex.values()]
    .map((record) => record.cockpit)
    .filter(
      (candidate) =>
        candidate.symbol !== stock.symbol &&
        candidate.industries.includes(industry),
    )
    .slice(0, limit)
    .map((candidate) => ({
      symbol: candidate.symbol,
      name: candidate.name,
      market: candidate.market,
      tier: candidate.tier,
      tags: candidate.tags.slice(0, 3),
    }));
}

export function readArticle(relativePath: string): ParsedArticle | null {
  const absolute = vaultFile(relativePath);
  if (!absolute) return null;
  return parseArticleMarkdown(relativePath.replaceAll("\\", "/"), fs.readFileSync(absolute, "utf8"));
}

export function cursorPrompt(stock: StockCockpit): string {
  return [
    `对照 @${stock.path}，检查这只股票的研究页是否要更新。`,
    stock.summary ? `当前一句话逻辑：${stock.summary}` : "",
    "请重点：",
    "1. 预期跟踪里哪些该打勾、哪些过期",
    "2. 证伪条件有没有被碰到",
    "3. Timeline 是否要补最近的财报或新闻",
    "结论直接改对应 Markdown，不要另开一份。",
  ]
    .filter(Boolean)
    .join("\n");
}

function loadIndexes(root: string) {
  if (process.env.NODE_ENV !== "production") {
    cachedRoot = undefined;
    stockIndex = null;
    articleIndex = null;
  }

  if (cachedRoot === root && stockIndex && articleIndex) return;
  cachedRoot = root;
  stockIndex = new Map();
  articleIndex = [];

  for (const relativePath of listMarkdown(path.join(root, "Stocks"), "Stocks")) {
    const raw = fs.readFileSync(path.join(root, relativePath), "utf8");
    const cockpit = parseStockMarkdown(relativePath, raw);
    if (!cockpit.symbol) continue;
    stockIndex.set(symbolKey(cockpit.symbol, cockpit.market), { relativePath, cockpit });
  }

  for (const relativePath of listMarkdown(path.join(root, "Articles"), "Articles")) {
    if (relativePath.split(/[\\/]/).includes("attachments")) continue;
    const raw = fs.readFileSync(path.join(root, relativePath), "utf8");
    articleIndex.push(parseArticleMarkdown(relativePath, raw));
  }
}

function listMarkdown(absoluteDir: string, prefix: string): string[] {
  if (!fs.existsSync(absoluteDir)) return [];
  const files: string[] = [];

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (entry.name.endsWith(".md")) {
        files.push(path.join(prefix, path.relative(absoluteDir, full)).replaceAll("\\", "/"));
      }
    }
  };

  walk(absoluteDir);
  return files;
}
