import assert from "node:assert/strict";
import test from "node:test";
import { quoteCacheReady, resolveChangePercent, sourceLabel, STATS_VERSION } from "./cache-policy";

const now = Date.UTC(2026, 7, 14, 16, 0, 0);

test("rejects old snapshots that have price but no valuation", () => {
  assert.equal(
    quoteCacheReady(
      {
        fetchedAt: now - 60_000,
        statsVersion: 3,
        marketCap: null,
        trailingPE: null,
      },
      true,
      now,
    ),
    false,
  );
});

test("rejects current-version cache that still has no market cap or PE", () => {
  assert.equal(
    quoteCacheReady(
      {
        fetchedAt: now - 60_000,
        statsVersion: STATS_VERSION,
        marketCap: null,
        trailingPE: null,
      },
      true,
      now,
    ),
    false,
  );
});

test("accepts a fresh eastmoney snapshot with market cap", () => {
  assert.equal(
    quoteCacheReady(
      {
        fetchedAt: now - 60_000,
        statsVersion: STATS_VERSION,
        marketCap: 1.13e12,
        trailingPE: 8.09,
      },
      true,
      now,
    ),
    true,
  );
});

test("source labels distinguish cache from live eastmoney", () => {
  assert.equal(sourceLabel("eastmoney", true, false), "本地缓存");
  assert.equal(sourceLabel("eastmoney", false, false), "东方财富");
  assert.equal(sourceLabel("yahoo", true, true), "过期缓存");
});

test("drops Yahoo two-year chart change from old snapshots", () => {
  assert.equal(resolveChangePercent(19.22, -0.17, 3), -0.17);
  assert.equal(resolveChangePercent(-0.17, -0.2, STATS_VERSION), -0.17);
});
