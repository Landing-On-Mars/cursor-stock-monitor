import "server-only";

import { db } from "@/lib/db";
import { listStocks } from "@/lib/vault/repository";
import { watchlistSeedFromStock } from "@/lib/watchlist-map";

export function syncWatchlistFromVault() {
  if (process.env.NEXT_PHASE === "phase-production-build") return 0;

  try {
    const seeds = listStocks()
      .map(watchlistSeedFromStock)
      .filter((row): row is NonNullable<typeof row> => row !== null);
    if (seeds.length === 0) return 0;

    const dismissed = new Set(
      (
        db
          .prepare("SELECT symbol, market FROM watchlist_dismissed")
          .all() as Array<{ symbol: string; market: string }>
      ).map((row) => `${row.market}:${row.symbol.toUpperCase()}`),
    );

    const insert = db.prepare(
      `INSERT OR IGNORE INTO watchlist_items (symbol, name, market, category, note)
       VALUES (?, ?, ?, ?, ?)`,
    );
    const rename = db.prepare(
      `UPDATE watchlist_items SET name = ? WHERE symbol = ? AND market = ? AND name != ?`,
    );

    let imported = 0;
    db.transaction(() => {
      for (const seed of seeds) {
        if (dismissed.has(`${seed.market}:${seed.symbol}`)) continue;
        const inserted = insert.run(seed.symbol, seed.name, seed.market, seed.category, "");
        imported += inserted.changes;
        rename.run(seed.name, seed.symbol, seed.market, seed.name);
      }
    })();
    return imported;
  } catch (error) {
    console.error("Watchlist vault sync skipped:", error);
    return 0;
  }
}
