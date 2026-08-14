import { NextRequest, NextResponse } from "next/server";
import { MARKETS, type Market } from "@/lib/watchlist-types";
import { toYahooSymbol } from "@/lib/vault/symbols";
import type { QuoteBar, QuoteSnapshot } from "@/lib/quote-types";

export const dynamic = "force-dynamic";

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

type YahooQuote = {
  quoteResponse?: {
    result?: Array<{
      regularMarketPrice?: number;
      regularMarketChangePercent?: number;
      currency?: string;
      marketCap?: number;
      trailingPE?: number;
      forwardPE?: number;
      priceToBook?: number;
      epsTrailingTwelveMonths?: number;
      trailingAnnualDividendYield?: number;
      dividendYield?: number;
      fiftyTwoWeekHigh?: number;
      fiftyTwoWeekLow?: number;
    }>;
  };
};

const yahooHeaders = {
  Accept: "application/json",
  "User-Agent": "Mozilla/5.0 Northstar/1.0",
};

function emptySnapshot(yahooSymbol: string, error: string): QuoteSnapshot {
  return {
    yahooSymbol,
    price: null,
    changePercent: null,
    currency: "",
    marketCap: null,
    trailingPE: null,
    forwardPE: null,
    priceToBook: null,
    eps: null,
    dividendYield: null,
    fiftyTwoWeekHigh: null,
    fiftyTwoWeekLow: null,
    bars: [],
    error,
  };
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.trim();
  const market = request.nextUrl.searchParams.get("market")?.trim().toUpperCase();
  const range = request.nextUrl.searchParams.get("range")?.trim() || "6mo";

  if (!symbol || !market || !MARKETS.includes(market as Market)) {
    return NextResponse.json({ error: "请提供有效的股票代码和市场。" }, { status: 400 });
  }

  const yahooSymbol = toYahooSymbol(symbol, market);
  const chartUrl = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}`);
  chartUrl.searchParams.set("interval", "1d");
  chartUrl.searchParams.set("range", range);

  const quoteUrl = new URL("https://query1.finance.yahoo.com/v7/finance/quote");
  quoteUrl.searchParams.set("symbols", yahooSymbol);

  try {
    const [chartResponse, quoteResponse] = await Promise.all([
      fetch(chartUrl, { cache: "no-store", headers: yahooHeaders, signal: AbortSignal.timeout(8_000) }),
      fetch(quoteUrl, { cache: "no-store", headers: yahooHeaders, signal: AbortSignal.timeout(8_000) }),
    ]);

    if (!chartResponse.ok && !quoteResponse.ok) {
      return NextResponse.json(emptySnapshot(yahooSymbol, "行情暂时不可用。"));
    }

    const chart = chartResponse.ok ? ((await chartResponse.json()) as YahooChart) : {};
    const quote = quoteResponse.ok ? ((await quoteResponse.json()) as YahooQuote) : {};
    const result = chart.chart?.result?.[0];
    const snapshot = quote.quoteResponse?.result?.[0];
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

    const price = snapshot?.regularMarketPrice ?? result?.meta?.regularMarketPrice ?? null;
    const previous = result?.meta?.chartPreviousClose ?? result?.meta?.previousClose ?? null;
    const changePercent =
      snapshot?.regularMarketChangePercent ??
      (price != null && previous ? ((price - previous) / previous) * 100 : null);

    const payload: QuoteSnapshot = {
      yahooSymbol,
      price,
      changePercent,
      currency: snapshot?.currency ?? result?.meta?.currency ?? "",
      marketCap: snapshot?.marketCap ?? null,
      trailingPE: snapshot?.trailingPE ?? null,
      forwardPE: snapshot?.forwardPE ?? null,
      priceToBook: snapshot?.priceToBook ?? null,
      eps: snapshot?.epsTrailingTwelveMonths ?? null,
      dividendYield: snapshot?.dividendYield ?? snapshot?.trailingAnnualDividendYield ?? null,
      fiftyTwoWeekHigh: snapshot?.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: snapshot?.fiftyTwoWeekLow ?? null,
      bars,
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Quote fetch failed:", error);
    return NextResponse.json(emptySnapshot(yahooSymbol, "行情暂时不可用。"));
  }
}
