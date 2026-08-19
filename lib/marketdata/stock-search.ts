import type { Market } from "../watchlist-types";
import { canonicalSymbol, inferMarket, toYahooSymbol } from "../vault/symbols";

export type StockSearchResult = {
  symbol: string;
  yahooSymbol: string;
  name: string;
  market: Market;
};

type YahooQuote = {
  exchange?: string;
  longname?: string;
  quoteType?: string;
  shortname?: string;
  symbol?: string;
};

type EastmoneySuggestRow = {
  Classify?: string;
  Code?: string;
  MktNum?: string;
  Name?: string;
  QuoteID?: string;
  SecurityType?: string;
  SecurityTypeName?: string;
  UnifiedCode?: string;
};

const YAHOO_EXCHANGES: Record<string, Market> = {
  ASE: "US",
  NGM: "US",
  NMS: "US",
  NYQ: "US",
  PCX: "US",
  HKG: "HK",
  SHH: "CN",
  SHZ: "CN",
  ASX: "OTHER",
  TYO: "OTHER",
  JPX: "OTHER",
  OSA: "OTHER",
  KSC: "OTHER",
  KOE: "OTHER",
  KOS: "OTHER",
};

const EASTMONEY_SKIP = new Set(["NEEQ", "INDEX", "FUND", "BOND"]);

export function guessAddMarket(symbol: string): Market | null {
  const inferred = inferMarket(symbol);
  if (inferred) return inferred;
  const raw = symbol.trim().toUpperCase();
  if (/^\d{1,5}$/.test(raw)) return "HK";
  return null;
}

export function draftFromQuery(query: string): StockSearchResult | null {
  const raw = query.trim().toUpperCase();
  if (!raw) return null;
  const market = guessAddMarket(raw);
  if (!market) return null;
  const symbol = canonicalSymbol(raw, market);
  return {
    symbol,
    yahooSymbol: toYahooSymbol(symbol, market),
    name: symbol,
    market,
  };
}

export function parseYahooQuotes(quotes: YahooQuote[]): StockSearchResult[] {
  return quotes
    .filter((quote) => quote.quoteType === "EQUITY" && quote.symbol)
    .map((quote) => {
      const symbol = (quote.symbol as string).toUpperCase();
      if (symbol.endsWith(".XA")) return null;
      const market = marketFromYahoo(quote);
      if (!market) return null;
      const canonical = canonicalSymbol(symbol, market);
      return {
        symbol: canonical,
        yahooSymbol: symbol,
        name: quote.longname || quote.shortname || canonical,
        market,
      };
    })
    .filter((item): item is StockSearchResult => item != null);
}

export function parseEastmoneySuggest(payload: unknown): StockSearchResult[] {
  const table = asRecord(asRecord(payload)["QuotationCodeTable"]);
  const rows = Array.isArray(table.Data) ? table.Data : [];
  const results: StockSearchResult[] = [];

  for (const entry of rows) {
    const row = asRecord(entry) as EastmoneySuggestRow;
    const classify = String(row.Classify ?? "").toUpperCase();
    const typeName = String(row.SecurityTypeName ?? "");
    if (EASTMONEY_SKIP.has(classify) || /三板|指数|基金|债券|购A|沽A/.test(typeName)) continue;
    if (String(row.SecurityType ?? "") === "6" || String(row.SecurityType ?? "") === "11") continue;

    const market = marketFromEastmoney(row);
    if (!market) continue;

    const code = String(row.UnifiedCode || row.Code || "").trim();
    if (!code) continue;
    const symbol = canonicalSymbol(code, market);
    results.push({
      symbol,
      yahooSymbol: toYahooSymbol(symbol, market),
      name: String(row.Name || symbol).trim() || symbol,
      market,
    });
  }

  return results;
}

export function mergeSearchResults(
  query: string,
  groups: StockSearchResult[][],
): StockSearchResult[] {
  const seen = new Set<string>();
  const merged: StockSearchResult[] = [];
  for (const group of groups) {
    for (const item of group) {
      const key = `${item.market}:${item.symbol}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
  }
  return merged.sort((left, right) => rankScore(left, query) - rankScore(right, query));
}

function marketFromEastmoney(row: EastmoneySuggestRow): Market | null {
  const quoteId = String(row.QuoteID ?? "");
  const mkt = String(row.MktNum ?? "");
  if (quoteId.startsWith("116.") || mkt === "116") return "HK";
  if (quoteId.startsWith("1.") || quoteId.startsWith("0.") || mkt === "1" || mkt === "0") {
    return "CN";
  }
  if (quoteId.startsWith("105.") || quoteId.startsWith("106.") || mkt === "105" || mkt === "106") {
    return "US";
  }
  return null;
}

function marketFromYahoo(quote: YahooQuote): Market | null {
  if (quote.exchange && YAHOO_EXCHANGES[quote.exchange]) return YAHOO_EXCHANGES[quote.exchange];
  const symbol = quote.symbol?.toUpperCase() ?? "";
  if (symbol.endsWith(".AX")) return "OTHER";
  return null;
}

function tickerBase(symbol: string) {
  return symbol.replace(/\.[A-Z]{1,3}$/i, "").toUpperCase();
}

function rankScore(result: StockSearchResult, query: string): number {
  const raw = query.trim().toUpperCase();
  const guessed = guessAddMarket(raw);
  const canonical = guessed ? canonicalSymbol(raw, guessed) : raw;
  if (result.symbol === raw || result.symbol === canonical) return 0;
  if (tickerBase(result.symbol) === raw || tickerBase(result.yahooSymbol) === raw) return 1;
  if (guessed && result.market === guessed && stripZeros(result.symbol) === stripZeros(raw)) {
    return 2;
  }
  if (result.name.toUpperCase().includes(raw) || result.symbol.includes(raw)) return 3;
  return 4;
}

function stripZeros(value: string) {
  return value.replace(/^0+/, "") || "0";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
