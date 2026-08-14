export type YahooStats = {
  marketCap: number | null;
  enterpriseValue: number | null;
  trailingPE: number | null;
  forwardPE: number | null;
  enterpriseToEbitda: number | null;
  profitMargin: number | null;
  operatingMargin: number | null;
  forwardDividendYield: number | null;
};

export function rawNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value === "object" && "raw" in value) {
    const raw = (value as { raw?: unknown }).raw;
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  }
  return null;
}

export function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = rawNumber(value);
    if (parsed != null) return parsed;
  }
  return null;
}

export function emptyStats(): YahooStats {
  return {
    marketCap: null,
    enterpriseValue: null,
    trailingPE: null,
    forwardPE: null,
    enterpriseToEbitda: null,
    profitMargin: null,
    operatingMargin: null,
    forwardDividendYield: null,
  };
}

export function statsFromQuoteSummary(data: unknown): YahooStats {
  const result = firstRecord(asRecord(asRecord(data)["quoteSummary"])["result"]);
  const summary = asRecord(result?.summaryDetail);
  const stats = asRecord(result?.defaultKeyStatistics);
  const financials = asRecord(result?.financialData);

  return {
    marketCap: firstNumber(summary.marketCap, stats.marketCap),
    enterpriseValue: firstNumber(stats.enterpriseValue),
    trailingPE: firstNumber(summary.trailingPE, stats.trailingPE),
    forwardPE: firstNumber(summary.forwardPE, stats.forwardPE),
    enterpriseToEbitda: firstNumber(stats.enterpriseToEbitda, financials.enterpriseToEbitda),
    profitMargin: firstNumber(financials.profitMargins, stats.profitMargins),
    operatingMargin: firstNumber(financials.operatingMargins, stats.operatingMargins),
    forwardDividendYield: firstNumber(summary.dividendYield, summary.yield),
  };
}

export function statsFromQuote(data: unknown): YahooStats {
  const quote = asRecord(firstRecord(asRecord(asRecord(data)["quoteResponse"])["result"]));
  return {
    marketCap: firstNumber(quote.marketCap),
    enterpriseValue: firstNumber(quote.enterpriseValue),
    trailingPE: firstNumber(quote.trailingPE),
    forwardPE: firstNumber(quote.forwardPE),
    enterpriseToEbitda: firstNumber(quote.enterpriseToEbitda),
    profitMargin: firstNumber(quote.profitMargins),
    operatingMargin: firstNumber(quote.operatingMargins),
    forwardDividendYield: firstNumber(quote.dividendYield, quote.trailingAnnualDividendYield),
  };
}

export function mergeStats(preferred: YahooStats, fallback: YahooStats): YahooStats {
  return {
    marketCap: preferred.marketCap ?? fallback.marketCap,
    enterpriseValue: preferred.enterpriseValue ?? fallback.enterpriseValue,
    trailingPE: preferred.trailingPE ?? fallback.trailingPE,
    forwardPE: preferred.forwardPE ?? fallback.forwardPE,
    enterpriseToEbitda: preferred.enterpriseToEbitda ?? fallback.enterpriseToEbitda,
    profitMargin: preferred.profitMargin ?? fallback.profitMargin,
    operatingMargin: preferred.operatingMargin ?? fallback.operatingMargin,
    forwardDividendYield: preferred.forwardDividendYield ?? fallback.forwardDividendYield,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function firstRecord(value: unknown): Record<string, unknown> | undefined {
  if (!Array.isArray(value)) return undefined;
  const row = value[0];
  return row && typeof row === "object" ? (row as Record<string, unknown>) : undefined;
}
