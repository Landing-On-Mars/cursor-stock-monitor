import assert from "node:assert/strict";
import test from "node:test";
import {
  asRatio,
  mergeStats,
  rawNumber,
  statsFromQuote,
  statsFromQuoteSummary,
} from "./yahoo-fields";

test("reads Yahoo { raw } wrappers and plain numbers", () => {
  assert.equal(rawNumber(12.5), 12.5);
  assert.equal(rawNumber({ raw: 0.183 }), 0.183);
  assert.equal(rawNumber({ fmt: "18.3%" }), null);
  assert.equal(rawNumber(null), null);
});

test("maps quoteSummary statistics used on Yahoo's key statistics page", () => {
  const stats = statsFromQuoteSummary({
    quoteSummary: {
      result: [
        {
          summaryDetail: {
            marketCap: { raw: 80000000000 },
            trailingPE: { raw: 28.4 },
            forwardPE: { raw: 22.1 },
            dividendYield: { raw: 0.012 },
          },
          defaultKeyStatistics: {
            enterpriseValue: { raw: 92000000000 },
            enterpriseToEbitda: { raw: 16.7 },
          },
          financialData: {
            profitMargins: { raw: 0.21 },
            operatingMargins: { raw: 0.18 },
          },
        },
      ],
    },
  });

  assert.equal(stats.marketCap, 80000000000);
  assert.equal(stats.enterpriseValue, 92000000000);
  assert.equal(stats.trailingPE, 28.4);
  assert.equal(stats.forwardPE, 22.1);
  assert.equal(stats.enterpriseToEbitda, 16.7);
  assert.equal(stats.profitMargin, 0.21);
  assert.equal(stats.operatingMargin, 0.18);
  assert.equal(stats.forwardDividendYield, 0.012);
});

test("falls back to the v7 quote payload when summary is missing a field", () => {
  const merged = mergeStats(
    statsFromQuoteSummary({ quoteSummary: { result: [{}] } }),
    statsFromQuote({
      quoteResponse: {
        result: [{ marketCap: 1, trailingPE: 10, dividendYield: 0.03, operatingMargins: 0.11 }],
      },
    }),
  );
  assert.equal(merged.marketCap, 1);
  assert.equal(merged.trailingPE, 10);
  assert.equal(merged.forwardDividendYield, 0.03);
  assert.equal(merged.operatingMargin, 0.11);
});

test("normalizes percent margins and drops junk Eastmoney yields", () => {
  assert.equal(asRatio(0.30596), 0.30596);
  assert.equal(asRatio(33.756), 0.33756);
  assert.equal(asRatio(-3.72), null);

  const merged = mergeStats(
    {
      marketCap: 1,
      enterpriseValue: null,
      trailingPE: 8,
      forwardPE: null,
      enterpriseToEbitda: null,
      profitMargin: 0,
      operatingMargin: 0,
      forwardDividendYield: -3.72,
    },
    {
      marketCap: 1,
      enterpriseValue: 9e11,
      trailingPE: 8,
      forwardPE: 6.4,
      enterpriseToEbitda: 3.8,
      profitMargin: 0.306,
      operatingMargin: 0.447,
      forwardDividendYield: 0.0536,
    },
  );
  assert.equal(merged.enterpriseValue, 9e11);
  assert.equal(merged.forwardPE, 6.4);
  assert.equal(merged.enterpriseToEbitda, 3.8);
  assert.equal(merged.profitMargin, 0.306);
  assert.equal(merged.operatingMargin, 0.447);
  assert.equal(merged.forwardDividendYield, 0.0536);
});
