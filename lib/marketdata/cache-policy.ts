export const STATS_VERSION = 6;
export const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

export type QuoteCacheMeta = {
  fetchedAt?: number;
  statsVersion?: number;
  marketCap?: number | null;
  trailingPE?: number | null;
};

export function quoteCacheReady(
  snapshot: QuoteCacheMeta | null | undefined,
  coversRange: boolean,
  now = Date.now(),
): boolean {
  if (!snapshot) return false;
  const fetchedAt = snapshot.fetchedAt ?? 0;
  if (fetchedAt <= 0 || now - fetchedAt >= CACHE_MAX_AGE_MS) return false;
  if (!coversRange) return false;
  if ((snapshot.statsVersion ?? 0) < STATS_VERSION) return false;
  // Old Yahoo-only snapshots often have price + K-line but no valuation.
  if (snapshot.marketCap == null && snapshot.trailingPE == null) return false;
  return true;
}

export function resolveChangePercent(
  stored: number | null | undefined,
  dailyChange: number | null,
  statsVersion?: number,
): number | null {
  if ((statsVersion ?? 0) >= STATS_VERSION) return stored ?? dailyChange;
  return dailyChange ?? stored ?? null;
}

export function sourceLabel(source?: string, fromCache?: boolean, stale?: boolean): string {
  if (fromCache) return stale ? "过期缓存" : "本地缓存";
  if (source === "mixed") return "Yahoo / 东财";
  if (source === "eastmoney") return "东方财富";
  if (source === "yahoo") return "Yahoo";
  return source?.trim() || "";
}
