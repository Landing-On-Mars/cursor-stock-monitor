export type ExpectationRow = {
  text: string;
  deadline: string;
  status: string;
  statusKind: "pending" | "met" | "drift" | "miss" | "unknown";
  result: string;
};

export type TimelineRow = {
  date: string;
  type: string;
  event: string;
};

export type ValuationRow = {
  date: string;
  price: string;
  method: string;
  assumption: string;
  value: string;
  takeaway: string;
};

export type CatalystRow = {
  text: string;
  detail: string;
  status: string;
  statusKind: ExpectationRow["statusKind"];
};

export type ArticleSummary = {
  path: string;
  title: string;
  source: string;
  publishedAt: string;
  status: string;
  summary: string;
};

export type PeerStock = {
  symbol: string;
  name: string;
  market: string;
  tier: string;
  tags: string[];
};

export type StockCockpit = {
  path: string;
  symbol: string;
  name: string;
  market: string;
  exchange: string;
  currency: string;
  tier: string;
  industries: string[];
  tags: string[];
  nextEarnings: string;
  updatedAt: string;
  summary: string;
  thesis: string;
  metrics: string[];
  risks: string[];
  expectations: ExpectationRow[];
  catalysts: CatalystRow[];
  buyConditions: string[];
  sellConditions: string[];
  valuations: ValuationRow[];
  timeline: TimelineRow[];
  notes: string[];
};
