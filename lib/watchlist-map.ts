import { canonicalSymbol, inferMarket, normalizeMarket } from "./vault/symbols";
import {
  MARKETS,
  type Market,
  type WatchlistCategory,
} from "./watchlist-types";

export type WatchlistSeed = {
  symbol: string;
  name: string;
  market: Market;
  category: WatchlistCategory;
};

export function categoryFromVaultTier(tier: string): WatchlistCategory {
  const value = tier.trim().toLowerCase();
  if (value === "core") return "CORE";
  if (value === "watch") return "WATCH";
  return "OTHER";
}

export function watchlistSeedFromStock(stock: {
  symbol: string;
  name: string;
  market: string;
  tier: string;
}): WatchlistSeed | null {
  const rawSymbol = stock.symbol.trim();
  if (!rawSymbol) return null;

  const market = normalizeMarket(stock.market) ?? inferMarket(rawSymbol);
  if (!market || !MARKETS.includes(market)) return null;

  const symbol = canonicalSymbol(rawSymbol, market);
  if (!symbol) return null;

  return {
    symbol,
    name: stock.name.trim() || symbol,
    market,
    category: categoryFromVaultTier(stock.tier),
  };
}
