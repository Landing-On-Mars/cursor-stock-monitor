import assert from "node:assert/strict";
import test from "node:test";
import { statsFromCnMainIndicator, statsFromHkMainIndicator } from "./eastmoney-f10";

test("maps HK F10 main indicators onto valuation stats", () => {
  const stats = statsFromHkMainIndicator({
    result: {
      data: [
        {
          TOTAL_MARKET_CAP: 1132163503898.88,
          PE_TTM: 8.094,
          NET_PROFIT_RATIO: 33.756,
          OPERATE_PROFIT: 52258000000,
          OPERATE_INCOME: 116079000000,
          DIVIDEND_RATE: 5.3736,
        },
      ],
    },
  });
  assert.equal(stats.marketCap, 1132163503898.88);
  assert.equal(stats.trailingPE, 8.094);
  assert.equal(stats.profitMargin, 33.756);
  assert.ok(stats.operatingMargin != null && Math.abs(stats.operatingMargin - 0.4502) < 0.001);
  assert.equal(stats.forwardDividendYield, 5.3736);
  assert.equal(stats.enterpriseValue, null);
});

test("maps A-share F10 net and operating margins", () => {
  const stats = statsFromCnMainIndicator({
    result: {
      data: [
        {
          XSJLL: 50.75,
          OPERATE_PROFIT_PK: 61411291686.27,
          OPERATE_INCOME_PK: 90703260964.48,
        },
      ],
    },
  });
  assert.equal(stats.profitMargin, 50.75);
  assert.ok(stats.operatingMargin != null && Math.abs(stats.operatingMargin - 0.677) < 0.001);
});
