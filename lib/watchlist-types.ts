export const WATCHLIST_CATEGORIES = ["CORE", "WATCH", "LOW_FREQUENCY"] as const;
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
  notePath: string;
  exchange: string;
  currency: string;
  industries: string[];
  tags: string[];
  thesis: string;
  articleCount: number;
  createdAt: string;
};

export type CreateWatchlistItem = {
  symbol: string;
  name: string;
  market: Market;
  category: WatchlistCategory;
  note?: string;
  notePath?: string;
  exchange?: string;
  currency?: string;
  industries?: string[];
  tags?: string[];
  thesis?: string;
  articleCount?: number;
};
