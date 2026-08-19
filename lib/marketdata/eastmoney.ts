import { canonicalSymbol } from "../vault/symbols";
import { emptyStats, type YahooStats } from "./yahoo-fields";

const HOSTS = [
  "https://push2delay.eastmoney.com",
  "https://push2.eastmoney.com",
];

const FIELDS =
  "f43,f58,f60,f116,f162,f163,f164,f167,f170,f186,f187,f193";

export type EastmoneyQuote = YahooStats & {
  price: number | null;
  changePercent: number | null;
  name: string;
};

export function eastmoneySecid(symbol: string, market: string): string | null {
  const canonical = canonicalSymbol(symbol, market);
  if (!canonical) return null;
  if (market === "HK") return `116.${canonical.replace(/^0+/, "").padStart(5, "0")}`;
  if (market === "CN") {
    const code = canonical.padStart(6, "0");
    const prefix = code.startsWith("6") || code.startsWith("9") ? "1" : "0";
    return `${prefix}.${code}`;
  }
  if (market === "US") return `105.${canonical}`;
  return null;
}

export function eastmoneySecuCode(symbol: string, market: string): string | null {
  const canonical = canonicalSymbol(symbol, market);
  if (!canonical) return null;
  if (market === "HK") return `${canonical.replace(/^0+/, "").padStart(5, "0")}.HK`;
  if (market === "CN") {
    const code = canonical.padStart(6, "0");
    const suffix = code.startsWith("6") || code.startsWith("9") ? "SH" : "SZ";
    return `${code}.${suffix}`;
  }
  return null;
}

export function statsFromEastmoney(data: unknown): EastmoneyQuote {
  const row = asRecord(asRecord(data)["data"]);
  const trailingPE = num(row.f164) ?? num(row.f163);
  return {
    price: num(row.f43),
    changePercent: num(row.f170),
    name: typeof row.f58 === "string" ? row.f58 : "",
    marketCap: num(row.f116),
    enterpriseValue: null,
    trailingPE,
    forwardPE: num(row.f162),
    enterpriseToEbitda: null,
    profitMargin: percent(row.f187),
    operatingMargin: percent(row.f186),
    forwardDividendYield: percent(row.f193),
  };
}

export async function fetchEastmoneyQuote(symbol: string, market: string): Promise<EastmoneyQuote> {
  const secid = eastmoneySecid(symbol, market);
  if (!secid) throw new Error("Eastmoney does not cover this market.");

  let lastError: unknown;
  for (const host of HOSTS) {
    try {
      const url = new URL("/api/qt/stock/get", host);
      url.searchParams.set("secid", secid);
      url.searchParams.set("invt", "2");
      url.searchParams.set("fltt", "2");
      url.searchParams.set("fields", FIELDS);
      const response = await fetch(url, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 Northstar/1.0",
          Referer: "https://quote.eastmoney.com/",
        },
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) throw new Error(`Eastmoney returned ${response.status}`);
      const json: unknown = await response.json();
      const parsed = statsFromEastmoney(json);
      if (parsed.price == null && parsed.marketCap == null && parsed.trailingPE == null) {
        throw new Error("Eastmoney returned empty quote.");
      }
      return parsed;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Eastmoney quote failed.");
}

export function emptyEastmoney(): EastmoneyQuote {
  return { ...emptyStats(), price: null, changePercent: null, name: "" };
}

function num(value: unknown): number | null {
  if (value == null || value === "-" || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed === 0) return null;
  return parsed;
}

function percent(value: unknown): number | null {
  return num(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
