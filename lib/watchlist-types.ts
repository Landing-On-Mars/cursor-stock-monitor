export const WATCHLIST_CATEGORIES = ["CORE", "WATCH"] as const;
export const MARKETS = ["US", "HK", "CN"] as const;

export type WatchlistCategory = (typeof WATCHLIST_CATEGORIES)[number];
export type Market = (typeof MARKETS)[number];

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
