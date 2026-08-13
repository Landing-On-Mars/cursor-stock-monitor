import "server-only";

import { getDb } from "@/lib/db";
import type { VaultArticle } from "@/lib/vault/articles";

export type StoredArticle = VaultArticle & {
  content?: string;
};

type ArticleRow = {
  path: string;
  title: string;
  source: string;
  author: string;
  published_at: string;
  saved_at: string;
  symbols: string;
  industries: string;
  status: string;
  tags: string;
  content: string;
};

function parseJsonArray(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function toArticle(row: ArticleRow, includeContent: boolean): StoredArticle {
  return {
    title: row.title,
    path: row.path,
    source: row.source,
    author: row.author,
    publishedAt: row.published_at,
    savedAt: row.saved_at,
    symbols: parseJsonArray(row.symbols),
    industries: parseJsonArray(row.industries),
    status: row.status,
    tags: parseJsonArray(row.tags),
    ...(includeContent ? { content: row.content } : {}),
  };
}

const LIST_COLUMNS = `path, title, source, author, published_at, saved_at,
  symbols, industries, status, tags`;

export function listStoredArticles(symbol?: string): StoredArticle[] {
  const rows = getDb()
    .prepare(
      `SELECT ${LIST_COLUMNS}
       FROM articles
       ORDER BY
         CASE WHEN published_at != '' THEN published_at ELSE saved_at END DESC,
         title ASC`,
    )
    .all() as Array<Omit<ArticleRow, "content">>;

  const articles = rows.map((row) =>
    toArticle({ ...row, content: "" }, false),
  );
  if (!symbol?.trim()) return articles;

  const normalized = symbol.trim().toUpperCase();
  return articles.filter((article) =>
    article.symbols.some((entry) => entry.toUpperCase() === normalized),
  );
}

export function getStoredArticle(relativePath: string): StoredArticle {
  const row = getDb()
    .prepare(
      `SELECT ${LIST_COLUMNS}, content FROM articles WHERE path = ?`,
    )
    .get(relativePath) as ArticleRow | undefined;

  if (!row) {
    throw new Error(`找不到文章：${relativePath}`);
  }
  return toArticle(row, true);
}

export function storedArticleCount() {
  return (
    getDb().prepare("SELECT COUNT(*) AS count FROM articles").get() as {
      count: number;
    }
  ).count;
}

export function articleCountByStoredSymbol() {
  const counts = new Map<string, number>();
  for (const article of listStoredArticles()) {
    for (const symbol of article.symbols) {
      const key = symbol.toUpperCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

export function upsertStoredArticle(article: {
  path: string;
  title: string;
  source: string;
  author: string;
  publishedAt: string;
  savedAt: string;
  symbols: string[];
  industries: string[];
  status: string;
  tags: string[];
  content: string;
}) {
  getDb()
    .prepare(
      `INSERT INTO articles (
         path, title, source, author, published_at, saved_at,
         symbols, industries, status, tags, content, imported_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(path) DO UPDATE SET
         title = excluded.title,
         source = excluded.source,
         author = excluded.author,
         published_at = excluded.published_at,
         saved_at = excluded.saved_at,
         symbols = excluded.symbols,
         industries = excluded.industries,
         status = excluded.status,
         tags = excluded.tags,
         content = excluded.content,
         imported_at = excluded.imported_at`,
    )
    .run(
      article.path,
      article.title,
      article.source,
      article.author,
      article.publishedAt,
      article.savedAt,
      JSON.stringify(article.symbols),
      JSON.stringify(article.industries),
      article.status,
      JSON.stringify(article.tags),
      article.content,
      new Date().toISOString(),
    );
}
