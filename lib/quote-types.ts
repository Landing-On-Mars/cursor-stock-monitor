export type QuoteBar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type QuoteSnapshot = {
  yahooSymbol: string;
  price: number | null;
  changePercent: number | null;
  currency: string;
  marketCap: number | null;
  enterpriseValue: number | null;
  trailingPE: number | null;
  forwardPE: number | null;
  enterpriseToEbitda: number | null;
  profitMargin: number | null;
  operatingMargin: number | null;
  forwardDividendYield: number | null;
  dividendYield: number | null;
  priceToBook: number | null;
  eps: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  bars: QuoteBar[];
  fetchedAt?: number;
  source?: string;
  asOf?: string;
  stale?: boolean;
  fromCache?: boolean;
  statsVersion?: number;
  error?: string;
};
