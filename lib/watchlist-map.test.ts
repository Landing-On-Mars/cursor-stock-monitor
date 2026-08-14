import assert from "node:assert/strict";
import test from "node:test";
import { categoryFromVaultTier, watchlistSeedFromStock } from "./watchlist-map";

test("vault tiers map onto the three watchlist pools", () => {
  assert.equal(categoryFromVaultTier("core"), "CORE");
  assert.equal(categoryFromVaultTier("watch"), "WATCH");
  assert.equal(categoryFromVaultTier("archive"), "OTHER");
  assert.equal(categoryFromVaultTier("other"), "OTHER");
  assert.equal(categoryFromVaultTier(""), "OTHER");
});

test("vault stocks become watchlist rows with canonical tickers", () => {
  assert.deepEqual(
    watchlistSeedFromStock({
      symbol: "MRVL",
      name: "Marvell Technology",
      market: "US",
      tier: "core",
    }),
    { symbol: "MRVL", name: "Marvell Technology", market: "US", category: "CORE" },
  );
  assert.deepEqual(
    watchlistSeedFromStock({
      symbol: "0700.HK",
      name: "腾讯控股",
      market: "HK",
      tier: "core",
    }),
    { symbol: "0700", name: "腾讯控股", market: "HK", category: "CORE" },
  );
  assert.deepEqual(
    watchlistSeedFromStock({
      symbol: "300750.SZ",
      name: "宁德时代",
      market: "CN",
      tier: "watch",
    }),
    { symbol: "300750", name: "宁德时代", market: "CN", category: "WATCH" },
  );
  assert.deepEqual(
    watchlistSeedFromStock({
      symbol: "6981.T",
      name: "村田制作所",
      market: "JP",
      tier: "watch",
    }),
    { symbol: "6981.T", name: "村田制作所", market: "OTHER", category: "WATCH" },
  );
  assert.equal(
    watchlistSeedFromStock({ symbol: "", name: "x", market: "US", tier: "core" }),
    null,
  );
});
