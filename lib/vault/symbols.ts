import { MARKET_LABEL, type Market } from "../watchlist-types";

const OTHER_MARKETS = new Set(["OTHER", "JP", "KR", "UK", "GB", "CA", "TW", "SG", "AU", "ASX", "AX"]);

export function normalizeMarket(market?: string | null): Market | null {
  const resolved = (market ?? "").trim().toUpperCase();
  if (resolved === "US" || resolved === "HK" || resolved === "CN" || resolved === "OTHER") {
    return resolved;
  }
  if (OTHER_MARKETS.has(resolved)) return "OTHER";
  return null;
}

export function inferMarket(symbol: string): Market | null {
  const raw = symbol.trim().toUpperCase();
  if (raw.endsWith(".HK")) return "HK";
  if (raw.endsWith(".SS") || raw.endsWith(".SZ")) return "CN";
  if (raw.endsWith(".AX")) return "OTHER";
  if (/^\d{4}(\.HK)?$/.test(raw)) return "HK";
  if (/^\d{6}(\.(SS|SZ))?$/.test(raw)) return "CN";
  if (/^[A-Z]{1,5}$/.test(raw)) return "US";
  if (/\.[A-Z]{1,3}$/.test(raw)) return "OTHER";
  return null;
}

export function canonicalSymbol(symbol: string, market?: string | null): string {
  const raw = symbol.trim().toUpperCase();
  const stripped = raw.replace(/\.HK$/i, "").replace(/\.(SS|SZ)$/i, "");
  const resolved = (normalizeMarket(market) ?? inferMarket(raw) ?? "").toUpperCase();

  if (resolved === "HK") {
    const digits = stripped.replace(/^0+/, "") || "0";
    return digits.padStart(4, "0");
  }

  if (resolved === "CN") {
    return stripped.padStart(6, "0");
  }

  return raw;
}

export function toYahooSymbol(symbol: string, market?: string | null): string {
  const resolved = normalizeMarket(market) ?? inferMarket(symbol) ?? "US";
  const canonical = canonicalSymbol(symbol, resolved);
  if (resolved === "HK") return `${canonical}.HK`;
  if (resolved === "CN") {
    const raw = symbol.trim().toUpperCase();
    if (raw.endsWith(".SS") || raw.endsWith(".SZ")) return raw;
    return canonical.startsWith("6") || canonical.startsWith("9")
      ? `${canonical}.SS`
      : `${canonical}.SZ`;
  }
  return canonical;
}

export function exchangeLabel(symbol: string, market: Market): string {
  const raw = symbol.trim().toUpperCase();
  if (raw.endsWith(".AX")) return "澳股";
  if (raw.endsWith(".T")) return "日股";
  if (raw.endsWith(".KS") || raw.endsWith(".KQ")) return "韩股";
  if (raw.endsWith(".L")) return "英股";
  if (raw.endsWith(".TO") || raw.endsWith(".V")) return "加股";
  if (raw.endsWith(".TW") || raw.endsWith(".TWO")) return "台股";
  if (raw.endsWith(".SI")) return "新加坡";
  return MARKET_LABEL[market];
}

export function symbolKey(symbol: string, market?: string | null): string {
  const inferred = normalizeMarket(market) ?? inferMarket(symbol);
  return `${inferred ?? "OTHER"}:${canonicalSymbol(symbol, inferred)}`;
}

export function articleMentionsStock(
  articleSymbols: string[],
  stockSymbol: string,
  market: string,
): boolean {
  const target = symbolKey(stockSymbol, market);
  return articleSymbols.some((entry) => {
    const value = entry.trim();
    if (!value) return false;
    return symbolKey(value, inferMarket(value) ?? market) === target;
  });
}
