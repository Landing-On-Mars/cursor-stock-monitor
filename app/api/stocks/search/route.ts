import { NextRequest, NextResponse } from "next/server";
import type { Market } from "@/lib/watchlist-types";

export const dynamic = "force-dynamic";

type YahooQuote = {
  exchange?: string;
  longname?: string;
  quoteType?: string;
  shortname?: string;
  symbol?: string;
};

type YahooSearchResponse = {
  quotes?: YahooQuote[];
};

const exchangeMarkets: Record<string, Market> = {
  ASE: "US",
  NGM: "US",
  NMS: "US",
  NYQ: "US",
  PCX: "US",
  HKG: "HK",
  SHH: "CN",
  SHZ: "CN",
};

function normalizeSymbol(symbol: string, market: Market) {
  if (market === "HK") return symbol.replace(/\.HK$/i, "");
  if (market === "CN") return symbol.replace(/\.(SS|SZ)$/i, "");
  return symbol;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json([]);
  }

  if (query.length > 80) {
    return NextResponse.json({ error: "搜索内容过长。" }, { status: 400 });
  }

  const endpoint = new URL("https://query2.finance.yahoo.com/v1/finance/search");
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("quotesCount", "12");
  endpoint.searchParams.set("newsCount", "0");
  endpoint.searchParams.set("lang", "zh-Hans");
  endpoint.searchParams.set("region", "CN");

  try {
    const response = await fetch(endpoint, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 Northstar/1.0",
      },
      signal: AbortSignal.timeout(8_000),
    });

    if (response.status === 400) {
      return NextResponse.json([]);
    }

    if (!response.ok) {
      throw new Error(`Yahoo Finance returned ${response.status}`);
    }

    const data = (await response.json()) as YahooSearchResponse;
    const results = (data.quotes ?? [])
      .filter(
        (quote) =>
          quote.quoteType === "EQUITY" &&
          quote.symbol &&
          quote.exchange &&
          exchangeMarkets[quote.exchange],
      )
      .map((quote) => {
        const market = exchangeMarkets[quote.exchange as string];
        return {
          symbol: normalizeSymbol(quote.symbol as string, market),
          yahooSymbol: quote.symbol,
          name: quote.longname || quote.shortname || quote.symbol,
          market,
        };
      });

    return NextResponse.json(results);
  } catch (error) {
    console.error("Stock search failed:", error);
    return NextResponse.json(
      { error: "股票搜索服务暂时不可用，请稍后重试。" },
      { status: 502 },
    );
  }
}
