import "server-only";

import fs from "node:fs";
import path from "node:path";
import { resolveVaultPath } from "../vault/path";
import type { QuoteBar, QuoteSnapshot } from "../quote-types";
import { barsToCsv, csvToBars } from "./csv";

export type CachedQuote = {
  snapshot: QuoteSnapshot;
  bars: QuoteBar[];
};

type SnapshotFile = Omit<QuoteSnapshot, "bars"> & {
  fetchedAt: number;
};

function safeToken(value: string) {
  return value.replace(/[<>:"/\\|?*]/g, "_");
}

export function marketDataRoot(): string {
  const override = process.env.MARKETDATA_PATH?.trim();
  if (override) return path.resolve(/* turbopackIgnore: true */ override);

  const vault = resolveVaultPath();
  if (vault) return path.join(/* turbopackIgnore: true */ vault, "MarketData");

  return path.join(/* turbopackIgnore: true */ process.cwd(), "data", "marketdata");
}

function paths(symbol: string, market: string) {
  const root = path.join(
    /* turbopackIgnore: true */ marketDataRoot(),
    market.toUpperCase(),
    safeToken(symbol.toUpperCase()),
  );
  return {
    dir: root,
    csv: path.join(/* turbopackIgnore: true */ root, "kline.csv"),
    snapshot: path.join(/* turbopackIgnore: true */ root, "snapshot.json"),
  };
}

export function readCachedQuote(symbol: string, market: string): CachedQuote | null {
  const file = paths(symbol, market);
  if (
    !fs.existsSync(/* turbopackIgnore: true */ file.csv) &&
    !fs.existsSync(/* turbopackIgnore: true */ file.snapshot)
  ) {
    return null;
  }

  let bars: QuoteBar[] = [];
  let snapshot = emptyMeta(symbol);

  try {
    if (fs.existsSync(/* turbopackIgnore: true */ file.csv)) {
      bars = csvToBars(fs.readFileSync(/* turbopackIgnore: true */ file.csv, "utf8"));
    }
  } catch (error) {
    console.error("Read kline cache failed:", error);
  }

  try {
    if (fs.existsSync(/* turbopackIgnore: true */ file.snapshot)) {
      const parsed = JSON.parse(
        fs.readFileSync(/* turbopackIgnore: true */ file.snapshot, "utf8"),
      ) as SnapshotFile;
      snapshot = { ...snapshot, ...parsed, bars: [] };
    }
  } catch (error) {
    console.error("Read snapshot cache failed:", error);
  }

  if (bars.length === 0 && snapshot.price == null && !snapshot.fetchedAt) return null;
  return { snapshot, bars };
}

export function writeCachedQuote(symbol: string, market: string, cached: CachedQuote) {
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const file = paths(symbol, market);
  fs.mkdirSync(/* turbopackIgnore: true */ file.dir, { recursive: true });
  writeAtomic(file.csv, barsToCsv(cached.bars));
  const { bars, ...meta } = cached.snapshot;
  void bars;
  const payload: SnapshotFile = {
    ...meta,
    fetchedAt: cached.snapshot.fetchedAt ?? Date.now(),
  };
  writeAtomic(file.snapshot, `${JSON.stringify(payload, null, 2)}\n`);
}

export function isFresh(snapshot: QuoteSnapshot, maxAgeMs = 6 * 60 * 60 * 1000) {
  const fetchedAt = snapshot.fetchedAt ?? 0;
  return fetchedAt > 0 && Date.now() - fetchedAt < maxAgeMs;
}

function writeAtomic(dest: string, body: string) {
  const tmp = `${dest}.${process.pid}.tmp`;
  fs.writeFileSync(/* turbopackIgnore: true */ tmp, body);
  try {
    fs.renameSync(/* turbopackIgnore: true */ tmp, dest);
  } catch {
    if (fs.existsSync(/* turbopackIgnore: true */ dest)) {
      fs.unlinkSync(/* turbopackIgnore: true */ dest);
    }
    fs.renameSync(/* turbopackIgnore: true */ tmp, dest);
  }
}

function emptyMeta(symbol: string): QuoteSnapshot {
  return {
    yahooSymbol: symbol,
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
    fetchedAt: 0,
  };
}
