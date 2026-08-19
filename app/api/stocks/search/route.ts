import { NextRequest, NextResponse } from "next/server";
import {
  mergeSearchResults,
  parseEastmoneySuggest,
  parseYahooQuotes,
  type StockSearchResult,
} from "@/lib/marketdata/stock-search";
import { yahooRequestHeaders } from "@/lib/marketdata/yahoo-session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json([]);
  }

  if (query.length > 80) {
    return NextResponse.json({ error: "搜索内容过长。" }, { status: 400 });
  }

  const [yahoo, eastmoney] = await Promise.all([
    searchYahoo(query),
    searchEastmoney(query),
  ]);

  const results = mergeSearchResults(query, [eastmoney, yahoo]).slice(0, 12);
  return NextResponse.json(results);
}

async function searchYahoo(query: string): Promise<StockSearchResult[]> {
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
        ...yahooRequestHeaders(),
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return [];
    const data = (await response.json()) as { quotes?: Parameters<typeof parseYahooQuotes>[0] };
    return parseYahooQuotes(data.quotes ?? []);
  } catch (error) {
    console.error("Yahoo stock search failed:", error);
    return [];
  }
}

async function searchEastmoney(query: string): Promise<StockSearchResult[]> {
  const endpoint = new URL("https://searchapi.eastmoney.com/api/suggest/get");
  endpoint.searchParams.set("input", query);
  endpoint.searchParams.set("type", "14");
  endpoint.searchParams.set("token", "D43BF722C8E33BDC906FB84D85E326E8");
  endpoint.searchParams.set("count", "12");

  try {
    const response = await fetch(endpoint, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Referer: "https://www.eastmoney.com/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return [];
    return parseEastmoneySuggest(await response.json());
  } catch (error) {
    console.error("Eastmoney stock search failed:", error);
    return [];
  }
}
