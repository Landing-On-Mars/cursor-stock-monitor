import fs from "node:fs";
import path from "node:path";
import {
  asString,
  asStringArray,
  parseFrontmatter,
} from "@/lib/vault/frontmatter";
import { rewriteArticleMedia } from "@/lib/vault/assets";

export type VaultArticle = {
  title: string;
  path: string;
  source: string;
  author: string;
  publishedAt: string;
  savedAt: string;
  symbols: string[];
  industries: string[];
  status: string;
  tags: string[];
};

let cache:
  | {
      vaultRoot: string;
      scannedAt: number;
      articles: VaultArticle[];
    }
  | undefined;

const CACHE_TTL_MS = 30_000;

export function invalidateArticleCache() {
  cache = undefined;
}

export function scanVaultArticles(vaultRoot: string, force = false): VaultArticle[] {
  const now = Date.now();
  if (
    !force &&
    cache &&
    cache.vaultRoot === vaultRoot &&
    now - cache.scannedAt < CACHE_TTL_MS
  ) {
    return cache.articles;
  }

  const articlesDir = path.join(vaultRoot, "Articles");
  if (!fs.existsSync(articlesDir)) {
    cache = { vaultRoot, scannedAt: now, articles: [] };
    return [];
  }

  const articles = fs
    .readdirSync(articlesDir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => {
      const relativePath = path.join("Articles", name);
      const source = fs.readFileSync(path.join(articlesDir, name), "utf8");
      const { data } = parseFrontmatter(source);
      const title =
        asString(data.title) ||
        name.replace(/\.md$/, "").replace(/^.*?[：:]/, "").trim() ||
        name;

      return {
        title,
        path: relativePath,
        source: asString(data.source),
        author: asString(data.author),
        publishedAt: asString(data.published_at),
        savedAt: asString(data.saved_at),
        symbols: asStringArray(data.symbols),
        industries: asStringArray(data.industries),
        status: asString(data.status, "inbox"),
        tags: asStringArray(data.tags),
      } satisfies VaultArticle;
    })
    .sort((left, right) => {
      const leftDate = left.publishedAt || left.savedAt || "";
      const rightDate = right.publishedAt || right.savedAt || "";
      return rightDate.localeCompare(leftDate);
    });

  cache = { vaultRoot, scannedAt: now, articles };
  return articles;
}

export function articlesForSymbol(vaultRoot: string, symbol: string) {
  const normalized = symbol.trim().toUpperCase();
  return scanVaultArticles(vaultRoot).filter((article) =>
    article.symbols.some((entry) => entry.toUpperCase() === normalized),
  );
}

export function articleCountBySymbol(vaultRoot: string) {
  const counts = new Map<string, number>();
  for (const article of scanVaultArticles(vaultRoot)) {
    for (const symbol of article.symbols) {
      const key = symbol.toUpperCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

export type VaultArticleContent = VaultArticle & {
  content: string;
  rawContent: string;
  absolutePath: string;
};

function assertArticlePath(relativePath: string) {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (
    !normalized.startsWith("Articles/") ||
    normalized.includes("..") ||
    !normalized.endsWith(".md")
  ) {
    throw new Error("只能读取 Articles 目录下的 Markdown 文件。");
  }
  return normalized;
}

export function readVaultArticle(
  vaultRoot: string,
  relativePath: string,
): VaultArticleContent {
  const safePath = assertArticlePath(relativePath);
  const absolutePath = path.join(vaultRoot, safePath);
  const resolved = path.resolve(absolutePath);
  const articlesRoot = path.resolve(path.join(vaultRoot, "Articles"));

  if (!resolved.startsWith(articlesRoot + path.sep)) {
    throw new Error("文章路径超出 Vault Articles 范围。");
  }
  if (!fs.existsSync(resolved)) {
    throw new Error(`找不到文章：${safePath}`);
  }

  const sourceText = fs.readFileSync(resolved, "utf8");
  const { data, content } = parseFrontmatter(sourceText);
  const name = path.basename(safePath);
  const body = content.trim();
  const rewritten = rewriteArticleMedia(body, vaultRoot, safePath);

  return {
    title:
      asString(data.title) ||
      name.replace(/\.md$/, "").replace(/^.*?[：:]/, "").trim() ||
      name,
    path: safePath,
    absolutePath: resolved,
    source: asString(data.source),
    author: asString(data.author),
    publishedAt: asString(data.published_at),
    savedAt: asString(data.saved_at),
    symbols: asStringArray(data.symbols),
    industries: asStringArray(data.industries),
    status: asString(data.status, "inbox"),
    tags: asStringArray(data.tags),
    content: rewritten,
    rawContent: body,
  };
}

export function writeVaultArticle(
  vaultRoot: string,
  relativePath: string,
  body: string,
) {
  const current = readVaultArticle(vaultRoot, relativePath);
  const sourceText = fs.readFileSync(current.absolutePath, "utf8");
  const next = replaceMarkdownBody(sourceText, body);
  fs.writeFileSync(current.absolutePath, next);
  invalidateArticleCache();
  return readVaultArticle(vaultRoot, relativePath);
}

function quoteYaml(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function safeFileStem(value: string) {
  return value
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function createVaultArticle(
  vaultRoot: string,
  input: {
    title: string;
    date: string;
    body: string;
    symbols: string[];
    source?: string;
    tags?: string[];
  },
) {
  const title = input.title.trim();
  if (!title) {
    throw new Error("请填写标题。");
  }

  const date = input.date.trim() || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("日期格式应为 YYYY-MM-DD。");
  }

  const symbols = input.symbols
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);
  if (symbols.length === 0) {
    throw new Error("请选择关联股票。");
  }

  const stamp = date.replace(/-/g, "");
  const stem = safeFileStem(`${symbols[0]} ${stamp}：${title}`);
  const articlesDir = path.join(vaultRoot, "Articles");
  fs.mkdirSync(articlesDir, { recursive: true });

  let filename = `${stem}.md`;
  let relativePath = `Articles/${filename}`;
  let suffix = 2;
  while (fs.existsSync(path.join(vaultRoot, relativePath))) {
    filename = `${stem}-${suffix}.md`;
    relativePath = `Articles/${filename}`;
    suffix += 1;
  }

  const tags = [...new Set(["article", "idea", ...(input.tags ?? [])])];
  const yamlTags = tags.map((tag) => `  - ${quoteYaml(tag)}`).join("\n");
  const yamlSymbols = symbols.map((symbol) => `  - ${quoteYaml(symbol)}`).join("\n");
  const body = `${input.body.replace(/\r\n/g, "\n").trim()}\n`;
  const source = `---
schema_version: 1
type: article
title: ${quoteYaml(title)}
url: ""
source: ${quoteYaml(input.source?.trim() || "我的想法")}
author: ""
published_at: ${quoteYaml(date)}
saved_at: ${quoteYaml(date)}
symbols:
${yamlSymbols}
industries: []
status: inbox
rating: ""
tags:
${yamlTags}
---

${body}`;

  fs.writeFileSync(path.join(vaultRoot, relativePath), source, "utf8");
  invalidateArticleCache();
  return readVaultArticle(vaultRoot, relativePath);
}

function replaceMarkdownBody(source: string, body: string) {
  const normalized = `${body.replace(/\r\n/g, "\n").trimEnd()}\n`;
  if (!source.startsWith("---")) return normalized;
  const end = source.indexOf("\n---", 3);
  if (end < 0) return normalized;
  const header = source.slice(0, end + 4).replace(/[ \t]+$/u, "");
  return `${header}\n\n${normalized}`;
}
