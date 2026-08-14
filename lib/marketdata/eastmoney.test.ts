import assert from "node:assert/strict";
import test from "node:test";
import { eastmoneySecid, eastmoneySecuCode, statsFromEastmoney } from "./eastmoney";

test("builds Eastmoney secid for HK, CN and US", () => {
  assert.equal(eastmoneySecid("0700", "HK"), "116.00700");
  assert.equal(eastmoneySecid("3330.HK", "HK"), "116.03330");
  assert.equal(eastmoneySecid("300750.SZ", "CN"), "0.300750");
  assert.equal(eastmoneySecid("600519", "CN"), "1.600519");
  assert.equal(eastmoneySecid("MRVL", "US"), "105.MRVL");
});

test("builds Eastmoney F10 secu codes", () => {
  assert.equal(eastmoneySecuCode("0883", "HK"), "00883.HK");
  assert.equal(eastmoneySecuCode("0700", "HK"), "00700.HK");
  assert.equal(eastmoneySecuCode("600519", "CN"), "600519.SH");
  assert.equal(eastmoneySecuCode("300750.SZ", "CN"), "300750.SZ");
});

test("maps Eastmoney quote fields onto valuation stats", () => {
  const stats = statsFromEastmoney({
    data: {
      f43: 21.42,
      f58: "灵宝黄金",
      f116: 29509152322.86,
      f162: "-",
      f163: 19.12,
      f164: 17.27,
      f170: 4.18,
      f186: 0,
      f187: 0,
      f193: 1.12,
    },
  });
  assert.equal(stats.price, 21.42);
  assert.equal(stats.changePercent, 4.18);
  assert.equal(stats.marketCap, 29509152322.86);
  assert.equal(stats.trailingPE, 17.27);
  assert.equal(stats.forwardPE, null);
  assert.equal(stats.operatingMargin, null);
  assert.equal(stats.forwardDividendYield, 1.12);
});
