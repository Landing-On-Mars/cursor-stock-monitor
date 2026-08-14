import "server-only";

import { toYahooSymbol } from "../vault/symbols";
import type { QuoteSnapshot } from "../quote-types";
import { coversRange, dateKey, mergeBars, sliceBars } from "./csv";
import { isFresh, readCachedQuote, writeCachedQuote } from "./store";
import { fetchYahooQuote } from "./yahoo";

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
    (cached.snapshot.statsVersion ?? 0) >= 3;

  if (cached && cacheReady) {
    return present(cached.snapshot, cached.bars, range, { fromCache: true, stale: false });
  }

  try {
    const live = await fetchYahooQuote(yahooSymbol);
    const bars = mergeBars(cached?.bars ?? [], live.bars);
    const snapshot: QuoteSnapshot = {
      ...cached?.snapshot,
      ...live,
      bars: [],
      fetchedAt: Date.now(),
      source: live.source ?? "yahoo",
      error: undefined,
    };
    writeCachedQuote(symbol, market, { snapshot, bars });
    return present(snapshot, bars, range, { fromCache: false, stale: false });
  } catch (error) {
    console.error("Quote fetch failed:", error);
    if (cached && (cached.bars.length > 0 || cached.snapshot.price != null)) {
      return present(cached.snapshot, cached.bars, range, {
        fromCache: true,
        stale: true,
      });
    }
    return emptySnapshot(yahooSymbol, "行情暂时不可用。");
  }
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
