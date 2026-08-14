import { asList, asString, parseFrontmatter } from "./frontmatter";
import { findSection, splitSections } from "./markdown";
import type { ArticleSummary } from "./types";

export type ParsedArticle = ArticleSummary & {
  symbols: string[];
  body: string;
  points: string;
  impact: string;
  judgment: string;
};

export function parseArticleMarkdown(relativePath: string, raw: string): ParsedArticle {
  const { data, body } = parseFrontmatter(raw);
  const sections = splitSections(body);
  const summary =
    findSection(sections, /摘要|summary/i)?.content ??
    firstQuote(body) ??
    "";

  const legacySymbols = [
    ...asList(data.symbols),
    asString(data.related_stock),
    ...asList(data.related_tickers),
  ];

  return {
    path: relativePath,
    title: asString(data.title) || titleFromPath(relativePath),
    source: asString(data.source),
    publishedAt: asString(data.published_at) || asString(data.date),
    status: asString(data.status),
    summary: collapse(summary),
    symbols: [...new Set(legacySymbols.map((item) => item.trim()).filter(Boolean))],
    body,
    points: collapse(findSection(sections, /关键观点/)?.content ?? ""),
    impact: collapse(findSection(sections, /对投资逻辑的影响/)?.content ?? ""),
    judgment: collapse(findSection(sections, /我的判断/)?.content ?? ""),
  };
}

function firstQuote(body: string): string {
  const match = body.match(/^>\s*(.+)$/m);
  return match?.[1]?.trim() ?? "";
}

function titleFromPath(relativePath: string): string {
  return relativePath.replace(/^Articles\//, "").replace(/\.md$/, "");
}

function collapse(value: string): string {
  return value.replace(/```[\s\S]*?```/g, "").replace(/\n{3,}/g, "\n\n").trim();
}
