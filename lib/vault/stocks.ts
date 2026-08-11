import fs from "node:fs";
import path from "node:path";
import {
  asString,
  asStringArray,
  extractThesis,
  parseFrontmatter,
} from "@/lib/vault/frontmatter";
import type { Market, WatchlistCategory } from "@/lib/watchlist-types";

export type VaultStock = {
  symbol: string;
  name: string;
  market: Market;
  category: WatchlistCategory;
  notePath: string;
  exchange: string;
  currency: string;
  industries: string[];
  tags: string[];
  thesis: string;
  status: string;
};

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

function readStocksIndex(vaultRoot: string) {
  const csvPath = path.join(vaultRoot, ".workbuddy/migration/stocks-index.csv");
  if (!fs.existsSync(csvPath)) {
    throw new Error(`找不到 stocks-index.csv：${csvPath}`);
  }

  const text = fs.readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((key, index) => {
      row[key] = cells[index] ?? "";
    });
    return row;
  });
}

function toCategory(tier: string): WatchlistCategory {
  return tier.trim().toLowerCase() === "core" ? "CORE" : "WATCH";
}

function toMarket(value: string): Market {
  const market = value.trim().toUpperCase();
  if (market === "US" || market === "HK" || market === "CN") return market;
  throw new Error(`不支持的市场：${value}`);
}

export function scanVaultStocks(vaultRoot: string): VaultStock[] {
  const rows = readStocksIndex(vaultRoot);
  const stocks: VaultStock[] = [];

  for (const row of rows) {
    const notePath = row.note_path;
    const absolute = path.join(vaultRoot, notePath);
    if (!fs.existsSync(absolute)) {
      throw new Error(`股票笔记不存在：${notePath}`);
    }

    const source = fs.readFileSync(absolute, "utf8");
    const { data, content } = parseFrontmatter(source);
    const symbol = asString(data.symbol, row.symbol);
    const market = toMarket(asString(data.market, row.market));

    stocks.push({
      symbol,
      name: asString(data.name, row.name),
      market,
      category: toCategory(asString(data.tier, row.tier)),
      notePath,
      exchange: asString(data.exchange),
      currency: asString(data.currency),
      industries: asStringArray(data.industries),
      tags: asStringArray(data.tags),
      thesis: extractThesis(content),
      status: asString(data.status, "active"),
    });
  }

  return stocks.sort((left, right) => {
    if (left.category !== right.category) {
      return left.category === "CORE" ? -1 : 1;
    }
    if (left.market !== right.market) return left.market.localeCompare(right.market);
    return left.symbol.localeCompare(right.symbol);
  });
}
