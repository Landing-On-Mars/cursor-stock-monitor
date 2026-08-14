import "server-only";

import { toYahooSymbol } from "../vault/symbols";
import type { QuoteSnapshot } from "../quote-types";
import { changeFromBars, coversRange, dateKey, mergeBars, sliceBars } from "./csv";
import { emptyEastmoney, fetchEastmoneyQuote } from "./eastmoney";
import { isFresh, readCachedQuote, writeCachedQuote } from "./store";
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
): Promise<QuoteSnapshot> {
  const yahooSymbol = toYahooSymbol(symbol, market);
  const cached = readCachedQuote(symbol, market);
  const cacheReady =
    cached != null &&
    isFresh(cached.snapshot) &&
    coversRange(cached.bars, range) &&
    (cached.snapshot.statsVersion ?? 0) >= 4 &&
    cached.snapshot.marketCap != null;

  if (cached && cacheReady) {
    return present(cached.snapshot, cached.bars, range, { fromCache: true, stale: false });
  }

  const [yahooResult, eastmoneyResult] = await Promise.allSettled([
    fetchYahooQuote(yahooSymbol),
    fetchEastmoneyQuote(symbol, market),
  ]);
  const yahoo = yahooResult.status === "fulfilled" ? yahooResult.value : null;
  const eastmoney = eastmoneyResult.status === "fulfilled" ? eastmoneyResult.value : emptyEastmoney();

  if (yahooResult.status === "rejected") console.error("Yahoo quote failed:", yahooResult.reason);
  if (eastmoneyResult.status === "rejected") console.error("Eastmoney quote failed:", eastmoneyResult.reason);

  const bars = mergeBars(cached?.bars ?? [], yahoo?.bars ?? []);
  const yahooStats = snapshotStats(yahoo);
  const stats =
    market === "US"
      ? mergeStats(yahooStats, eastmoney)
      : mergeStats(eastmoney, yahooStats);

  if (bars.length === 0 && stats.marketCap == null && (yahoo?.price ?? eastmoney.price) == null) {
    if (cached && (cached.bars.length > 0 || cached.snapshot.price != null)) {
      return present(cached.snapshot, cached.bars, range, { fromCache: true, stale: true });
    }
    return emptySnapshot(yahooSymbol, "行情暂时不可用。");
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
    source: eastmoney.marketCap != null ? "eastmoney" : (yahoo?.source ?? "yahoo"),
    statsVersion: 4,
  };
  writeCachedQuote(symbol, market, { snapshot, bars });
  return present(snapshot, bars, range, { fromCache: false, stale: false });
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
  flags: { fromCache: boolean; stale: boolean },
): QuoteSnapshot {
  const sliced = sliceBars(bars, range);
  const last = sliced[sliced.length - 1] ?? bars[bars.length - 1];
  return {
    ...snapshot,
    bars: sliced,
    asOf: last ? dateKey(last.time) : undefined,
    fromCache: flags.fromCache,
    stale: flags.stale,
    forwardDividendYield: snapshot.forwardDividendYield ?? snapshot.dividendYield ?? null,
    error: flags.stale ? undefined : snapshot.error,
  };
}

type QuoteBarLike = { time: number; open: number; high: number; low: number; close: number };
