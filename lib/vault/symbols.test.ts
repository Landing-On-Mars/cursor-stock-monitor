import assert from "node:assert/strict";
import test from "node:test";
import { articleMentionsStock, canonicalSymbol, symbolKey, toYahooSymbol } from "./symbols";

test("canonical HK symbols drop exchange suffix and pad to 4 digits", () => {
  assert.equal(canonicalSymbol("0700.HK", "HK"), "0700");
  assert.equal(canonicalSymbol("00700", "HK"), "0700");
  assert.equal(canonicalSymbol("3993.HK"), "3993");
});

test("canonical CN symbols keep 6 digits without exchange suffix", () => {
  assert.equal(canonicalSymbol("000858.SZ", "CN"), "000858");
  assert.equal(canonicalSymbol("600036.SS"), "600036");
});

test("article symbols match watchlist tickers", () => {
  assert.equal(symbolKey("0700", "HK"), "HK:0700");
  assert.equal(articleMentionsStock(["0700.HK"], "0700", "HK"), true);
  assert.equal(articleMentionsStock(["LITE"], "LITE", "US"), true);
  assert.equal(articleMentionsStock(["MRVL"], "0700", "HK"), false);
});

test("Yahoo symbols keep exchange suffixes", () => {
  assert.equal(toYahooSymbol("0700", "HK"), "0700.HK");
  assert.equal(toYahooSymbol("000858", "CN"), "000858.SZ");
  assert.equal(toYahooSymbol("600036", "CN"), "600036.SS");
  assert.equal(toYahooSymbol("MRVL", "US"), "MRVL");
  assert.equal(toYahooSymbol("6981.T", "OTHER"), "6981.T");
  assert.equal(toYahooSymbol("005930.KS", "JP"), "005930.KS");
});

test("other-market stocks share the OTHER key", () => {
  assert.equal(symbolKey("6981.T", "JP"), "OTHER:6981.T");
  assert.equal(symbolKey("6981.T", "OTHER"), "OTHER:6981.T");
  assert.equal(articleMentionsStock(["6981.T"], "6981.T", "OTHER"), true);
});
