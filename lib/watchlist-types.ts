export const WATCHLIST_CATEGORIES = ["CORE", "WATCH", "OTHER"] as const;
export const MARKETS = ["US", "HK", "CN", "OTHER"] as const;

export type WatchlistCategory = (typeof WATCHLIST_CATEGORIES)[number];
export type Market = (typeof MARKETS)[number];

export const CATEGORY_LABEL: Record<WatchlistCategory, string> = {
  CORE: "核心",
  WATCH: "观察",
  OTHER: "其他",
};

export const MARKET_LABEL: Record<Market, string> = {
  US: "美股",
  HK: "港股",
  CN: "A股",
  OTHER: "其他",
};

export type WatchlistItem = {
  id: number;
  symbol: string;
  name: string;
  market: Market;
  category: WatchlistCategory;
  note: string;
  createdAt: string;
};

export type CreateWatchlistItem = Omit<WatchlistItem, "id" | "createdAt">;
