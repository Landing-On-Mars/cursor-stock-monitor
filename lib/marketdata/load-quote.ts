import "server-only";

import { toYahooSymbol } from "../vault/symbols";
import type { QuoteSnapshot } from "../quote-types";
import { STATS_VERSION, quoteCacheReady, resolveChangePercent } from "./cache-policy";
import { changeFromBars, coversRange, dateKey, mergeBars, sliceBars } from "./csv";
import { emptyEastmoney, fetchEastmoneyQuote } from "./eastmoney";
import { fetchEastmoneyFundamentals } from "./eastmoney-f10";
import { readCachedQuote, writeCachedQuote } from "./store";
import { fetchYahooQuote } from "./yahoo";
import { emptyStats, mergeStats, type YahooStats } from "./yahoo-fields";

export function emptySnapshot(yahooSymbol: string, error: string): QuoteSnapshot {
  return {
    yahooSymbol,
    price: null,
    changePercent: null,
    currency: "",
    marketCap: null,
    enterpriseValue: null,
    trailingPE: null,
    forwardPE: null,
    enterpriseToEbitda: null,
    profitMargin: null,
    operatingMargin: null,
    forwardDividendYield: null,
    dividendYield: null,
    priceToBook: null,
    eps: null,
    fiftyTwoWeekHigh: null,
    fiftyTwoWeekLow: null,
    bars: [],
    error,
  };
}

export async function loadQuote(
  symbol: string,
  market: string,
  range: string,
  options?: { force?: boolean },
): Promise<QuoteSnapshot> {
  const yahooSymbol = toYahooSymbol(symbol, market);
  const cached = readCachedQuote(symbol, market);
  const cacheReady =
    !options?.force && quoteCacheReady(cached?.snapshot, coversRange(cached?.bars ?? [], range));

  if (cached && cacheReady) {
    return present(cached.snapshot, cached.bars, range, { fromCache: true, stale: false });
  }

  const [yahooResult, eastmoneyResult, f10Result] = await Promise.allSettled([
    fetchYahooQuote(yahooSymbol),
    fetchEastmoneyQuote(symbol, market),
    market === "US" ? Promise.resolve(emptyStats()) : fetchEastmoneyFundamentals(symbol, market),
  ]);
  const yahoo = yahooResult.status === "fulfilled" ? yahooResult.value : null;
  const eastmoney = eastmoneyResult.status === "fulfilled" ? eastmoneyResult.value : emptyEastmoney();
  const f10 = f10Result.status === "fulfilled" ? f10Result.value : emptyStats();

  const fetchErrors: string[] = [];
  if (yahooResult.status === "rejected") {
    console.error("Yahoo quote failed:", yahooResult.reason);
    fetchErrors.push(`Yahoo：${errorMessage(yahooResult.reason)}`);
  }
  if (eastmoneyResult.status === "rejected") {
    console.error("Eastmoney quote failed:", eastmoneyResult.reason);
    fetchErrors.push(`东财行情：${errorMessage(eastmoneyResult.reason)}`);
  }
  if (f10Result.status === "rejected" && market !== "US") {
    console.error("Eastmoney F10 failed:", f10Result.reason);
  }

  const bars = mergeBars(cached?.bars ?? [], yahoo?.bars ?? []);
  const yahooStats = snapshotStats(yahoo);
  const live = liveQuoteStats(eastmoney);
  const stats =
    market === "US"
      ? mergeStats(yahooStats, live)
      : mergeStats(live, yahooStats, f10, eastmoney);

  if (bars.length === 0 && stats.marketCap == null && (yahoo?.price ?? eastmoney.price) == null) {
    if (cached && (cached.bars.length > 0 || cached.snapshot.price != null)) {
      return present(cached.snapshot, cached.bars, range, {
        fromCache: true,
        stale: true,
        error: fetchErrors.length ? fetchErrors.join("；") : "行情暂时不可用，已用本地缓存。",
      });
    }
    return emptySnapshot(yahooSymbol, fetchErrors.join("；") || "行情暂时不可用。");
  }

  const snapshot: QuoteSnapshot = {
    yahooSymbol,
    price: yahoo?.price ?? eastmoney.price ?? cached?.snapshot.price ?? null,
    changePercent:
      eastmoney.changePercent ?? yahoo?.changePercent ?? changeFromBars(bars),
    currency: yahoo?.currency || (market === "HK" ? "HKD" : market === "CN" ? "CNY" : "USD"),
    marketCap: stats.marketCap,
    enterpriseValue: stats.enterpriseValue,
    trailingPE: stats.trailingPE,
    forwardPE: stats.forwardPE,
    enterpriseToEbitda: stats.enterpriseToEbitda,
    profitMargin: stats.profitMargin,
    operatingMargin: stats.operatingMargin,
    forwardDividendYield: stats.forwardDividendYield,
    dividendYield: stats.forwardDividendYield,
    priceToBook: yahoo?.priceToBook ?? cached?.snapshot.priceToBook ?? null,
    eps: yahoo?.eps ?? cached?.snapshot.eps ?? null,
    fiftyTwoWeekHigh: yahoo?.fiftyTwoWeekHigh ?? cached?.snapshot.fiftyTwoWeekHigh ?? null,
    fiftyTwoWeekLow: yahoo?.fiftyTwoWeekLow ?? cached?.snapshot.fiftyTwoWeekLow ?? null,
    bars: [],
    fetchedAt: Date.now(),
    source: quoteSource(yahooStats, eastmoney),
    statsVersion: STATS_VERSION,
    error: stats.marketCap == null && fetchErrors.length ? fetchErrors.join("；") : undefined,
  };
  writeCachedQuote(symbol, market, { snapshot, bars });
  return present(snapshot, bars, range, { fromCache: false, stale: false });
}

function liveQuoteStats(quote: YahooStats): YahooStats {
  return {
    marketCap: quote.marketCap,
    enterpriseValue: null,
    trailingPE: quote.trailingPE,
    forwardPE: quote.forwardPE,
    enterpriseToEbitda: null,
    profitMargin: quote.profitMargin,
    operatingMargin: quote.operatingMargin,
    forwardDividendYield: null,
  };
}

function quoteSource(yahooStats: YahooStats, eastmoney: YahooStats): string {
  const yahooFilled =
    yahooStats.enterpriseValue != null ||
    yahooStats.forwardPE != null ||
    yahooStats.profitMargin != null;
  const eastmoneyFilled = eastmoney.marketCap != null || eastmoney.trailingPE != null;
  if (yahooFilled && eastmoneyFilled) return "mixed";
  if (yahooFilled) return "yahoo";
  return eastmoneyFilled ? "eastmoney" : "yahoo";
}

function snapshotStats(snapshot: QuoteSnapshot | null): YahooStats {
  if (!snapshot) return emptyStats();
  return {
    marketCap: snapshot.marketCap,
    enterpriseValue: snapshot.enterpriseValue,
    trailingPE: snapshot.trailingPE,
    forwardPE: snapshot.forwardPE,
    enterpriseToEbitda: snapshot.enterpriseToEbitda,
    profitMargin: snapshot.profitMargin,
    operatingMargin: snapshot.operatingMargin,
    forwardDividendYield: snapshot.forwardDividendYield,
  };
}

function present(
  snapshot: QuoteSnapshot,
  bars: QuoteBarLike[],
  range: string,
  flags: { fromCache: boolean; stale: boolean; error?: string },
): QuoteSnapshot {
  const sliced = sliceBars(bars, range);
  const last = sliced[sliced.length - 1] ?? bars[bars.length - 1];
  const dailyChange = changeFromBars(sliced.length >= 2 ? sliced : bars);
  const changePercent = resolveChangePercent(snapshot.changePercent, dailyChange, snapshot.statsVersion);
  return {
    ...snapshot,
    changePercent,
    bars: sliced,
    asOf: last ? dateKey(last.time) : undefined,
    fromCache: flags.fromCache,
    stale: flags.stale,
    forwardDividendYield: snapshot.forwardDividendYield ?? snapshot.dividendYield ?? null,
    error: flags.error ?? (flags.stale ? undefined : snapshot.error),
  };
}

function errorMessage(reason: unknown): string {
  if (reason instanceof Error && reason.message) return reason.message;
  return String(reason);
}

type QuoteBarLike = { time: number; open: number; high: number; low: number; close: number };
