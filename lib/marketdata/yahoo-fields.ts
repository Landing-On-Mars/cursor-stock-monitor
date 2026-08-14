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

/** Eastmoney often stores 0 / negatives as missing; Yahoo uses 0.30 ratios, F10 uses 30 percents. */
export function asPositive(value: number | null): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

export function asRatio(value: number | null): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  if (value === 0) return null;
  if (value > 100) return null;
  if (value > 1) return value / 100;
  return value;
}

export function cleanStats(stats: YahooStats): YahooStats {
  return {
    marketCap: asPositive(stats.marketCap),
    enterpriseValue: asPositive(stats.enterpriseValue),
    trailingPE: asPositive(stats.trailingPE),
    forwardPE: asPositive(stats.forwardPE),
    enterpriseToEbitda: asPositive(stats.enterpriseToEbitda),
    profitMargin: asRatio(stats.profitMargin),
    operatingMargin: asRatio(stats.operatingMargin),
    forwardDividendYield: asRatio(stats.forwardDividendYield),
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

export function mergeStats(...sources: YahooStats[]): YahooStats {
  return sources.reduce<YahooStats>((acc, source) => {
    const cleaned = cleanStats(source);
    return {
      marketCap: acc.marketCap ?? cleaned.marketCap,
      enterpriseValue: acc.enterpriseValue ?? cleaned.enterpriseValue,
      trailingPE: acc.trailingPE ?? cleaned.trailingPE,
      forwardPE: acc.forwardPE ?? cleaned.forwardPE,
      enterpriseToEbitda: acc.enterpriseToEbitda ?? cleaned.enterpriseToEbitda,
      profitMargin: acc.profitMargin ?? cleaned.profitMargin,
      operatingMargin: acc.operatingMargin ?? cleaned.operatingMargin,
      forwardDividendYield: acc.forwardDividendYield ?? cleaned.forwardDividendYield,
    };
  }, emptyStats());
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
