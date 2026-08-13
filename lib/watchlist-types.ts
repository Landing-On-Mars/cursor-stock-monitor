export const WATCHLIST_CATEGORIES = ["CORE", "WATCH", "ARCHIVE"] as const;
export const MARKETS = ["US", "HK", "CN", "OTHER"] as const;

export type WatchlistCategory = (typeof WATCHLIST_CATEGORIES)[number];
export type Market = (typeof MARKETS)[number];

export const MARKET_LABELS: Record<Market, string> = {
  US: "美股",
  HK: "港股",
  CN: "A股",
  OTHER: "其他",
};

export const MARKET_BADGES: Record<Market, string> = {
  US: "US",
  HK: "HK",
  CN: "CN",
  OTHER: "其他",
};

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
