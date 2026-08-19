import "server-only";

import fs from "node:fs";
import path from "node:path";
import { parseArticleMarkdown, type ParsedArticle } from "./parse-article";
import { parseStockMarkdown } from "./parse-stock";
import {
  appendFocusNote,
  emptyJournalMarkdown,
  parseFocusNotes,
  parseLegacyObservationNotes,
  removeFocusNote,
  stripObservationSection,
  updateFocusNote,
} from "./focus-notes";
import { describeVaultPath, resolveVaultPath, vaultArticleAsset, vaultFile, vaultWritableFile } from "./path";
import { isStockJournalPath, stockJournalPath } from "./journal-path";
import { articleMentionsStock, symbolKey } from "./symbols";
import { articleAssetCandidates } from "./article-media";
import type { ArticleSummary, PeerStock, StockCockpit } from "./types";
import { replaceFrontmatterScalar, replaceMarkdownBody } from "./write-article";
import { replaceThesis } from "./write-stock";

export type VaultStatus = {
  ok: boolean;
  path: string | null;
  savedPath: string;
  source: "env" | "saved" | "auto" | null;
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

export function resetVaultCache() {
  cachedRoot = undefined;
  stockIndex = null;
  articleIndex = null;
}

export function getVaultStatus(): VaultStatus {
  const described = describeVaultPath();
  if (!described.ok || !described.resolvedPath) {
    return {
      ok: false,
      path: described.resolvedPath,
      savedPath: described.savedPath,
      source: described.source,
      stockCount: 0,
      articleCount: 0,
    };
  }
  loadIndexes(described.resolvedPath);
  return {
    ok: true,
    path: described.resolvedPath,
    savedPath: described.savedPath,
    source: described.source,
    stockCount: stockIndex?.size ?? 0,
    articleCount: articleIndex?.length ?? 0,
  };
}

export function listStocks(): StockCockpit[] {
  const root = resolveVaultPath();
  if (!root) return [];
  loadIndexes(root);
  return [...(stockIndex?.values() ?? [])].map((record) => record.cockpit);
}

export function findStock(symbol: string, market: string): StockCockpit | null {
  return findStockRecord(symbol, market)?.cockpit ?? null;
}

export function listStockFocusNotes(symbol: string, market: string) {
  const record = findStockRecord(symbol, market);
  if (!record) return [];
  migrateStockJournal(record);
  const absolute = vaultFile(stockJournalPath(record.relativePath));
  if (!absolute) return [];
  return parseFocusNotes(fs.readFileSync(absolute, "utf8"));
}

export function addStockFocusNote(symbol: string, market: string, notedAt: string, body: string) {
  return mutateJournalFile(symbol, market, (raw) => appendFocusNote(raw, notedAt, body));
}

export function updateStockFocusNote(
  symbol: string,
  market: string,
  id: string,
  notedAt: string,
  body: string,
) {
  return mutateJournalFile(symbol, market, (raw) => updateFocusNote(raw, id, notedAt, body));
}

export function removeStockFocusNote(symbol: string, market: string, id: string) {
  return mutateJournalFile(symbol, market, (raw) => removeFocusNote(raw, id));
}

export function updateStockThesis(symbol: string, market: string, thesis: string) {
  mutateStockFile(symbol, market, (raw) =>
    replaceFrontmatterScalar(replaceThesis(raw, thesis), "updated_at", localIsoDate()),
  );
  return findStock(symbol, market);
}

function findStockRecord(symbol: string, market: string): StockRecord | null {
  const root = resolveVaultPath();
  if (!root) return null;
  loadIndexes(root);
  return stockIndex?.get(symbolKey(symbol, market)) ?? null;
}

function mutateJournalFile(
  symbol: string,
  market: string,
  mutate: (raw: string) => string,
) {
  const record = findStockRecord(symbol, market);
  if (!record) {
    throw new Error("Vault 里还没有这只股票的档案。");
  }
  migrateStockJournal(record);
  const relativePath = stockJournalPath(record.relativePath);
  const absolute = vaultWritableFile(relativePath);
  if (!absolute) {
    throw new Error("找不到这只股票的日志文件。");
  }
  const current = fs.existsSync(absolute)
    ? fs.readFileSync(absolute, "utf8")
    : emptyJournalMarkdown(record.cockpit.symbol || symbol, record.cockpit.name);
  const next = mutate(current);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, next);
  resetVaultCache();
  return parseFocusNotes(next);
}

function migrateStockJournal(record: StockRecord) {
  const stockAbsolute = vaultFile(record.relativePath);
  if (!stockAbsolute) return;
  const stockRaw = fs.readFileSync(stockAbsolute, "utf8");
  const legacyNotes = parseLegacyObservationNotes(stockRaw);
  const hasLegacy = /^## 观察[ \t]*$/m.test(stockRaw.replace(/\r\n/g, "\n"));
  const journalRelative = stockJournalPath(record.relativePath);
  const journalAbsolute = vaultWritableFile(journalRelative);
  if (!journalAbsolute) return;

  const journalExists = fs.existsSync(journalAbsolute);
  if (!journalExists && legacyNotes.length > 0) {
    let journal = emptyJournalMarkdown(record.cockpit.symbol, record.cockpit.name);
    for (const note of [...legacyNotes].reverse()) {
      journal = appendFocusNote(journal, note.notedAt, note.body);
    }
    fs.mkdirSync(path.dirname(journalAbsolute), { recursive: true });
    fs.writeFileSync(journalAbsolute, journal);
  }

  if (hasLegacy) {
    fs.writeFileSync(stockAbsolute, stripObservationSection(stockRaw));
    resetVaultCache();
  }
}

function mutateStockFile(
  symbol: string,
  market: string,
  mutate: (raw: string) => string,
) {
  const record = findStockRecord(symbol, market);
  if (!record) {
    throw new Error("Vault 里还没有这只股票的档案。");
  }
  const absolute = vaultFile(record.relativePath);
  if (!absolute) {
    throw new Error("找不到这只股票的档案。");
  }
  const next = mutate(fs.readFileSync(absolute, "utf8"));
  fs.writeFileSync(absolute, next);
  resetVaultCache();
  return parseFocusNotes(next);
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

export function writeArticle(
  relativePath: string,
  body: string,
  fields?: { source?: string },
): ParsedArticle {
  const absolute = vaultFile(relativePath);
  if (!absolute) {
    throw new Error("找不到这篇文章。");
  }

  const current = fs.readFileSync(absolute, "utf8");
  let next = replaceMarkdownBody(current, body);
  if (fields?.source !== undefined) {
    next = replaceFrontmatterScalar(next, "source", fields.source.trim());
  }
  fs.writeFileSync(absolute, next);
  resetVaultCache();

  return parseArticleMarkdown(relativePath.replaceAll("\\", "/"), next);
}

export function resolveArticleAsset(articlePath: string, src: string): string | null {
  for (const candidate of articleAssetCandidates(articlePath, src)) {
    const absolute = vaultArticleAsset(candidate);
    if (absolute) return absolute;
  }
  return null;
}

export function cursorPrompt(stock: StockCockpit): string {
  return [
    `对照 @${stock.path}，检查这只股票的研究页是否要更新。`,
    stock.summary ? `当前一句话逻辑：${stock.summary}` : "",
    "请重点：",
    "1. 预期跟踪里哪些该打勾、哪些过期",
    "2. 投资逻辑有没有被新信息改写",
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
    if (isStockJournalPath(relativePath)) continue;
    try {
      const raw = fs.readFileSync(path.join(root, relativePath), "utf8");
      const cockpit = parseStockMarkdown(relativePath, raw);
      if (!cockpit.symbol) continue;
      stockIndex.set(symbolKey(cockpit.symbol, cockpit.market), { relativePath, cockpit });
    } catch (error) {
      console.error(`Skip stock file ${relativePath}:`, error);
    }
  }

  for (const relativePath of listMarkdown(path.join(root, "Articles"), "Articles")) {
    if (relativePath.split(/[\\/]/).includes("attachments")) continue;
    try {
      const raw = fs.readFileSync(path.join(root, relativePath), "utf8");
      articleIndex.push(parseArticleMarkdown(relativePath, raw));
    } catch (error) {
      console.error(`Skip article file ${relativePath}:`, error);
    }
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

function localIsoDate() {
  const now = new Date();
  const shifted = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 10);
}
