import { eastmoneySecuCode } from "./eastmoney";
import { asPositive, emptyStats, type YahooStats } from "./yahoo-fields";

type F10Row = Record<string, unknown>;

export function statsFromHkMainIndicator(data: unknown): YahooStats {
  const row = firstRow(data);
  const operateProfit = num(row.OPERATE_PROFIT);
  const operateIncome = num(row.OPERATE_INCOME);
  return {
    ...emptyStats(),
    marketCap: num(row.TOTAL_MARKET_CAP) ?? num(row.HKSK_MARKET_CAP),
    trailingPE: num(row.PE_TTM),
    profitMargin: num(row.NET_PROFIT_RATIO),
    operatingMargin:
      operateProfit != null && operateIncome ? operateProfit / operateIncome : null,
    forwardDividendYield: num(row.DIVIDEND_RATE),
  };
}

export function statsFromCnMainIndicator(data: unknown): YahooStats {
  const row = firstRow(data);
  const operateProfit = num(row.OPERATE_PROFIT_PK);
  const operateIncome = num(row.OPERATE_INCOME_PK);
  return {
    ...emptyStats(),
    profitMargin: num(row.XSJLL),
    operatingMargin:
      operateProfit != null && operateIncome ? operateProfit / operateIncome : null,
  };
}

export async function fetchEastmoneyFundamentals(symbol: string, market: string): Promise<YahooStats> {
  const secuCode = eastmoneySecuCode(symbol, market);
  if (!secuCode) throw new Error("Eastmoney F10 does not cover this market.");

  if (market === "HK") {
    const json = await fetchF10({
      reportName: "RPT_HKF10_FN_MAININDICATOR",
      columns:
        "STD_REPORT_DATE,TOTAL_MARKET_CAP,HKSK_MARKET_CAP,PE_TTM,NET_PROFIT_RATIO,OPERATE_PROFIT,OPERATE_INCOME,DIVIDEND_RATE",
      filter: `(SECUCODE="${secuCode}")`,
      sortColumns: "STD_REPORT_DATE",
    });
    const stats = statsFromHkMainIndicator(json);
    if (asPositive(stats.trailingPE) == null && asPositive(stats.profitMargin) == null) {
      throw new Error("Eastmoney F10 returned empty fundamentals.");
    }
    return stats;
  }

  if (market === "CN") {
    const json = await fetchF10({
      reportName: "RPT_F10_FINANCE_MAINFINADATA",
      columns: "REPORT_DATE,XSJLL,OPERATE_PROFIT_PK,OPERATE_INCOME_PK",
      filter: `(SECUCODE="${secuCode}")`,
      sortColumns: "REPORT_DATE",
    });
    const stats = statsFromCnMainIndicator(json);
    if (asPositive(stats.profitMargin) == null && asPositive(stats.operatingMargin) == null) {
      throw new Error("Eastmoney F10 returned empty fundamentals.");
    }
    return stats;
  }

  throw new Error("Eastmoney F10 does not cover this market.");
}

async function fetchF10(query: {
  reportName: string;
  columns: string;
  filter: string;
  sortColumns: string;
}): Promise<unknown> {
  const url = new URL("https://datacenter.eastmoney.com/securities/api/data/v1/get");
  url.searchParams.set("reportName", query.reportName);
  url.searchParams.set("columns", query.columns);
  url.searchParams.set("filter", query.filter);
  url.searchParams.set("pageNumber", "1");
  url.searchParams.set("pageSize", "1");
  url.searchParams.set("sortColumns", query.sortColumns);
  url.searchParams.set("sortTypes", "-1");
  url.searchParams.set("source", "F10");
  url.searchParams.set("client", "PC");

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Northstar/1.0",
      Referer: "https://emweb.securities.eastmoney.com/",
    },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Eastmoney F10 returned ${response.status}`);
  return response.json();
}

function firstRow(data: unknown): F10Row {
  const result = data && typeof data === "object" ? (data as { result?: { data?: unknown } }).result : undefined;
  const rows = result?.data;
  const row = Array.isArray(rows) ? rows[0] : undefined;
  return row && typeof row === "object" ? (row as F10Row) : {};
}

function num(value: unknown): number | null {
  if (value == null || value === "-" || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}
