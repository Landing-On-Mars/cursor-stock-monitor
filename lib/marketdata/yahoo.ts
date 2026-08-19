import "server-only";

import type { QuoteBar, QuoteSnapshot } from "../quote-types";
import { STATS_VERSION } from "./cache-policy";
import { changeFromBars } from "./csv";
import { emptyStats, mergeStats, statsFromQuote, statsFromQuoteSummary } from "./yahoo-fields";
import { clearYahooSession, getYahooSession, yahooRequestHeaders } from "./yahoo-session";

type YahooChart = {
  chart?: {
    result?: Array<{
      meta?: {
        currency?: string;
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
        }>;
      };
    }>;
  };
};

export const STORE_RANGE = "2y";
export const MONTHLY_RANGE = "max";

export async function fetchYahooBars(
  yahooSymbol: string,
  interval: "1d" | "1mo",
  range: string,
): Promise<QuoteBar[]> {
  const chartUrl = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}`);
  chartUrl.searchParams.set("interval", interval);
  chartUrl.searchParams.set("range", range);
  return barsFromChart((await fetchJson(chartUrl, false)) as YahooChart);
}

export async function fetchYahooQuote(yahooSymbol: string): Promise<QuoteSnapshot> {
  const chartUrl = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}`);
  chartUrl.searchParams.set("interval", "1d");
  chartUrl.searchParams.set("range", STORE_RANGE);

  const quoteUrl = new URL("https://query1.finance.yahoo.com/v7/finance/quote");
  quoteUrl.searchParams.set("symbols", yahooSymbol);

  const summaryUrl = new URL(
    `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(yahooSymbol)}`,
  );
  summaryUrl.searchParams.set("modules", "summaryDetail,defaultKeyStatistics,financialData");

  const [chartResult, quoteResult, summaryResult] = await Promise.allSettled([
    fetchJson(chartUrl, false),
    fetchJson(quoteUrl, true),
    fetchJson(summaryUrl, true),
  ]);

  const chart = (settled(chartResult) ?? {}) as YahooChart;
  const quote = settled(quoteResult);
  const summary = settled(summaryResult);

  if (
    chartResult.status === "rejected" &&
    quoteResult.status === "rejected" &&
    summaryResult.status === "rejected"
  ) {
    throw new Error("行情暂时不可用。");
  }

  const result = chart.chart?.result?.[0];
  const bars = barsFromChart(chart);

  const stats = mergeStats(
    summary ? statsFromQuoteSummary(summary) : emptyStats(),
    quote ? statsFromQuote(quote) : emptyStats(),
  );

  const quoteRow = firstQuoteRow(quote);
  const price = quoteRow?.regularMarketPrice ?? result?.meta?.regularMarketPrice ?? null;
  const changePercent = quoteRow?.regularMarketChangePercent ?? changeFromBars(bars);

  if (bars.length === 0 && price == null && stats.marketCap == null) {
    throw new Error("行情暂时不可用。");
  }

  return {
    yahooSymbol,
    price,
    changePercent,
    currency: quoteRow?.currency ?? result?.meta?.currency ?? "",
    marketCap: stats.marketCap,
    enterpriseValue: stats.enterpriseValue,
    trailingPE: stats.trailingPE,
    forwardPE: stats.forwardPE,
    enterpriseToEbitda: stats.enterpriseToEbitda,
    profitMargin: stats.profitMargin,
    operatingMargin: stats.operatingMargin,
    forwardDividendYield: stats.forwardDividendYield,
    dividendYield: stats.forwardDividendYield,
    priceToBook: null,
    eps: null,
    fiftyTwoWeekHigh: quoteRow?.fiftyTwoWeekHigh ?? null,
    fiftyTwoWeekLow: quoteRow?.fiftyTwoWeekLow ?? null,
    bars,
    source: "yahoo",
    statsVersion: STATS_VERSION,
  };
}

async function fetchJson(url: URL, auth: boolean): Promise<unknown> {
  const once = async () => {
    const session = auth ? await getYahooSession() : null;
    const target = new URL(url);
    if (session) target.searchParams.set("crumb", session.crumb);
    const response = await fetch(target, {
      cache: "no-store",
      headers: {
        ...yahooRequestHeaders(),
        ...(session ? { Cookie: session.cookie } : {}),
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (response.status === 401) {
      clearYahooSession();
      throw new Error(`Yahoo returned ${response.status}`);
    }
    if (!response.ok) throw new Error(`Yahoo returned ${response.status}`);
    return response.json();
  };

  try {
    return await once();
  } catch (error) {
    if (!auth) throw error;
    clearYahooSession();
    return await once();
  }
}

function barsFromChart(chart: YahooChart): QuoteBar[] {
  const result = chart.chart?.result?.[0];
  const series = result?.indicators?.quote?.[0];
  const times = result?.timestamp ?? [];
  const bars: QuoteBar[] = [];
  for (let index = 0; index < times.length; index += 1) {
    const open = series?.open?.[index];
    const high = series?.high?.[index];
    const low = series?.low?.[index];
    const close = series?.close?.[index];
    if (open == null || high == null || low == null || close == null) continue;
    bars.push({ time: times[index] * 1000, open, high, low, close });
  }
  return bars;
}

function settled(result: PromiseSettledResult<unknown>): unknown | null {
  return result.status === "fulfilled" ? result.value : null;
}

function firstQuoteRow(data: unknown): {
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  currency?: string;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
} | undefined {
  if (!data || typeof data !== "object") return undefined;
  const list = (data as { quoteResponse?: { result?: unknown[] } }).quoteResponse?.result;
  const row = Array.isArray(list) ? list[0] : undefined;
  return row && typeof row === "object" ? row : undefined;
}
