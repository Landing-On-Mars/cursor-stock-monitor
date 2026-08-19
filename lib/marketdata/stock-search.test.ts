import assert from "node:assert/strict";
import test from "node:test";
import {
  draftFromQuery,
  guessAddMarket,
  mergeSearchResults,
  parseEastmoneySuggest,
  parseYahooQuotes,
} from "./stock-search";

test("guesses HK for short digit tickers that inferMarket would miss", () => {
  assert.equal(guessAddMarket("883"), "HK");
  assert.equal(guessAddMarket("0883"), "HK");
  assert.equal(guessAddMarket("300308"), "CN");
  assert.equal(guessAddMarket("AAPL"), "US");
});

test("draftFromQuery fills a ticker-only add", () => {
  const draft = draftFromQuery("883");
  assert.equal(draft?.market, "HK");
  assert.equal(draft?.symbol, "0883");
  assert.equal(draft?.yahooSymbol, "0883.HK");
  const aus = draftFromQuery("FML.AX");
  assert.equal(aus?.market, "OTHER");
  assert.equal(aus?.symbol, "FML.AX");
  assert.equal(aus?.yahooSymbol, "FML.AX");
});

test("parseYahooQuotes keeps HK equities and drops unknown exchanges", () => {
  const results = parseYahooQuotes([
    {
      exchange: "HKG",
      longname: "CNOOC Limited",
      quoteType: "EQUITY",
      shortname: "CNOOC",
      symbol: "0883.HK",
    },
    {
      exchange: "TAI",
      quoteType: "EQUITY",
      symbol: "08835U.TW",
    },
  ]);
  assert.equal(results.length, 1);
  assert.equal(results[0]?.symbol, "0883");
  assert.equal(results[0]?.market, "HK");
  assert.equal(results[0]?.yahooSymbol, "0883.HK");
});

test("parseYahooQuotes keeps ASX FML and drops Chi-X tape", () => {
  const results = parseYahooQuotes([
    {
      exchange: "ASX",
      shortname: "FOCUS MIN FPO [FML]",
      quoteType: "EQUITY",
      symbol: "FML.AX",
    },
    {
      exchange: "CXA",
      quoteType: "EQUITY",
      symbol: "FML.XA",
    },
    {
      exchange: "TAI",
      quoteType: "EQUITY",
      symbol: "08835U.TW",
    },
  ]);
  assert.equal(results.length, 1);
  assert.equal(results[0]?.symbol, "FML.AX");
  assert.equal(results[0]?.market, "OTHER");
  assert.equal(results[0]?.yahooSymbol, "FML.AX");
});

test("mergeSearchResults ranks FML.AX first when querying FML", () => {
  const merged = mergeSearchResults("FML", [
    parseYahooQuotes([
      {
        exchange: "ASX",
        shortname: "FOCUS MIN FPO [FML]",
        quoteType: "EQUITY",
        symbol: "FML.AX",
      },
    ]),
  ]);
  assert.equal(merged[0]?.symbol, "FML.AX");
  assert.equal(merged[0]?.market, "OTHER");
});

test("parseEastmoneySuggest maps 港股 and A股, skips 三板", () => {
  const results = parseEastmoneySuggest({
    QuotationCodeTable: {
      Data: [
        {
          Code: "000883",
          Name: "湖北能源",
          Classify: "AStock",
          SecurityTypeName: "深A",
          MktNum: "0",
          QuoteID: "0.000883",
          UnifiedCode: "000883",
        },
        {
          Code: "00883",
          Name: "中国海洋石油",
          Classify: "HK",
          SecurityTypeName: "港股",
          MktNum: "116",
          QuoteID: "116.00883",
          UnifiedCode: "00883",
        },
        {
          Code: "830883",
          Name: "联桥新材",
          Classify: "NEEQ",
          SecurityTypeName: "三板",
          MktNum: "0",
          QuoteID: "0.830883",
          UnifiedCode: "830883",
        },
      ],
    },
  });
  assert.deepEqual(
    results.map((item) => `${item.market}:${item.symbol}:${item.name}`),
    ["CN:000883:湖北能源", "HK:0883:中国海洋石油"],
  );
});

test("mergeSearchResults ranks exact 0883 ahead of 000883", () => {
  const merged = mergeSearchResults("0883", [
    parseEastmoneySuggest({
      QuotationCodeTable: {
        Data: [
          {
            Code: "000883",
            Name: "湖北能源",
            Classify: "AStock",
            SecurityTypeName: "深A",
            MktNum: "0",
            QuoteID: "0.000883",
            UnifiedCode: "000883",
          },
          {
            Code: "00883",
            Name: "中国海洋石油",
            Classify: "HK",
            SecurityTypeName: "港股",
            MktNum: "116",
            QuoteID: "116.00883",
            UnifiedCode: "00883",
          },
        ],
      },
    }),
    parseYahooQuotes([
      {
        exchange: "HKG",
        longname: "CNOOC Limited",
        quoteType: "EQUITY",
        symbol: "0883.HK",
      },
    ]),
  ]);
  assert.equal(merged[0]?.symbol, "0883");
  assert.equal(merged[0]?.market, "HK");
  assert.equal(merged[0]?.name, "中国海洋石油");
  assert.equal(merged.filter((item) => item.symbol === "0883").length, 1);
});
