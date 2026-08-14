import { asList, asString, parseFrontmatter } from "./frontmatter";
import {
  extractBullets,
  findSection,
  firstItalic,
  labeledBullets,
  parseTables,
  splitSections,
  type MarkdownTable,
} from "./markdown";
import type {
  CatalystRow,
  ExpectationRow,
  StockCockpit,
  TimelineRow,
} from "./types";

export function parseStockMarkdown(relativePath: string, raw: string): StockCockpit {
  const { data, body } = parseFrontmatter(raw);
  const sections = splitSections(body);
  const thesis = findSection(sections, /investment thesis|核心投资逻辑/i)?.content ?? "";
  const notesSection = findSection(sections, /^notes$/i)?.content ?? "";
  const expectationSection = findSection(sections, /预期跟踪/)?.content ?? "";
  const catalystSection = findSection(sections, /催化剂/)?.content ?? "";
  const riskSection = findSection(sections, /证伪|主要风险/)?.content ?? "";
  const buySection = findSection(sections, /买入或加仓/)?.content ?? "";
  const sellSection = findSection(sections, /减仓或退出/)?.content ?? "";
  const timelineSection = findSection(sections, /^timeline$/i)?.content ?? "";

  const summary =
    firstItalic(thesis) ||
    asString(data.summary) ||
    thesis.split(/\n+/).find((line) => line.trim() && !line.startsWith("#") && !line.startsWith("**"))?.replace(/^>\s*/, "").trim() ||
    "";

  return {
    path: relativePath,
    symbol: asString(data.symbol),
    name: asString(data.name),
    market: asString(data.market).toUpperCase(),
    exchange: asString(data.exchange),
    currency: asString(data.currency),
    tier: asString(data.tier).toLowerCase(),
    industries: asList(data.industries),
    tags: asList(data.tags),
    nextEarnings: asString(data.next_earnings),
    updatedAt: asString(data.updated_at),
    summary,
    thesis: compactText(thesis),
    metrics: labeledBullets(thesis, /key metrics|关键跟踪指标/i),
    risks: unique([
      ...extractBullets(riskSection),
      ...labeledBullets(thesis, /风险/),
      ...labeledBullets(notesSection, /风险/),
    ]),
    expectations: parseExpectations(expectationSection),
    catalysts: parseCatalysts(catalystSection),
    buyConditions: extractBullets(buySection),
    sellConditions: extractBullets(sellSection),
    timeline: parseTimeline(timelineSection),
    notes: extractBullets(notesSection).slice(0, 8),
  };
}

function parseExpectations(content: string): ExpectationRow[] {
  const table = parseTables(content)[0];
  if (!table) return [];

  return table.rows.map((row) => {
    const cells = pickCells(table, row, {
      text: /预期|判断|内容/,
      deadline: /时点|日期|验证/,
      status: /状态/,
      result: /结果|记录|实际/,
    });
    const status = cells.status || row.find((cell) => statusKind(cell) !== "unknown") || "";
    return {
      text: cells.text || row.slice(1).find(Boolean) || row[0] || "",
      deadline: cells.deadline,
      status,
      statusKind: statusKind(status),
      result: cells.result,
    };
  }).filter((row) => row.text);
}

function parseCatalysts(content: string): CatalystRow[] {
  const table = parseTables(content)[0];
  if (table) {
    return table.rows.map((row) => {
      const cells = pickCells(table, row, {
        text: /催化|事件|标题/,
        detail: /进展|说明|内容/,
        status: /状态/,
      });
      const status = cells.status || row.find((cell) => statusKind(cell) !== "unknown") || "";
      return {
        text: cells.text || row[0] || "",
        detail: cells.detail || row[1] || "",
        status,
        statusKind: statusKind(status),
      };
    }).filter((row) => row.text);
  }

  return extractBullets(content).map((text) => ({
    text,
    detail: "",
    status: "",
    statusKind: "unknown" as const,
  }));
}

function parseTimeline(content: string): TimelineRow[] {
  const table = parseTables(content)[0];
  if (!table) return [];

  return table.rows.map((row) => {
    const cells = pickCells(table, row, {
      date: /date|日期|时间/,
      type: /type|类型|标签/,
      event: /event|note|事件|内容/,
    });
    const date = cells.date || row[0] || "";
    const leftover = row.filter((cell) => cell && cell !== date);
    return {
      date,
      type: normalizeType(cells.type || leftover.find((cell) => cell.startsWith("#")) || ""),
      event: cells.event || leftover.filter((cell) => !cell.startsWith("#")).join(" · "),
    };
  }).filter((row) => row.event).slice(0, 8);
}

function pickCells(
  table: MarkdownTable,
  row: string[],
  patterns: Record<string, RegExp>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, pattern] of Object.entries(patterns)) {
    const index = table.headers.findIndex((header) => pattern.test(header.replace(/\s+/g, "")));
    result[key] = index >= 0 ? (row[index] ?? "") : "";
  }
  return result;
}

export function statusKind(value: string): ExpectationRow["statusKind"] {
  if (/✅|达标|已完成/.test(value)) return "met";
  if (/🟡|偏差|进行中/.test(value)) return "drift";
  if (/❌|落空/.test(value)) return "miss";
  if (/🔲|待验证/.test(value)) return "pending";
  return "unknown";
}

function normalizeType(value: string): string {
  const raw = value.replace(/^#/, "").trim().toLowerCase();
  if (raw.includes("earn")) return "earnings";
  if (raw.includes("news") || raw.includes("新闻")) return "news";
  if (raw.includes("note") || raw.includes("笔记")) return "note";
  if (raw.includes("fil")) return "filing";
  return raw || "note";
}

function compactText(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
