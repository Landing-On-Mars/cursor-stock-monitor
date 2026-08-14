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
  trailingPE: number | null;
  forwardPE: number | null;
  priceToBook: number | null;
  eps: number | null;
  dividendYield: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  bars: QuoteBar[];
  fetchedAt?: number;
  source?: string;
  asOf?: string;
  stale?: boolean;
  fromCache?: boolean;
  error?: string;
};
