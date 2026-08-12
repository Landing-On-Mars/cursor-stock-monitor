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
    throw new Error(`找不到 Articles 目录：${articlesDir}`);
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
  const rewritten = rewriteArticleMedia(content.trim(), vaultRoot, safePath);

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
  };
}

export function buildObsidianUri(vaultRoot: string, relativePath: string) {
  const vaultName = path.basename(vaultRoot);
  const file = assertArticlePath(relativePath).replace(/\.md$/i, "");
  return `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(file)}`;
}
