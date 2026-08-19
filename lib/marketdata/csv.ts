import type { QuoteBar } from "../quote-types";

export const CHART_RANGES = ["daily", "monthly", "yearly"] as const;
export type ChartRange = (typeof CHART_RANGES)[number];

export const RANGE_MS: Record<string, number> = {
  "1mo": 31 * 86_400_000,
  "3mo": 93 * 86_400_000,
  "6mo": 186 * 86_400_000,
  "1y": 370 * 86_400_000,
  "2y": 740 * 86_400_000,
  "10y": 3650 * 86_400_000,
  "15y": 5475 * 86_400_000,
};

const CHART_SLICE: Record<ChartRange, string> = {
  daily: "1y",
  monthly: "10y",
  yearly: "15y",
};

export function dateKey(time: number): string {
  const date = new Date(time);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function timeFromDateKey(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, (month ?? 1) - 1, day ?? 1);
}

export function barsToCsv(bars: QuoteBar[]): string {
  const lines = ["date,open,high,low,close"];
  for (const bar of mergeBars([], bars)) {
    lines.push(
      [dateKey(bar.time), num(bar.open), num(bar.high), num(bar.low), num(bar.close)].join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

export function csvToBars(raw: string): QuoteBar[] {
  const bars: QuoteBar[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("date")) continue;
    const [date, open, high, low, close] = trimmed.split(",");
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const parsed = {
      time: timeFromDateKey(date),
      open: Number(open),
      high: Number(high),
      low: Number(low),
      close: Number(close),
    };
    if ([parsed.open, parsed.high, parsed.low, parsed.close].some((value) => !Number.isFinite(value))) {
      continue;
    }
    bars.push(parsed);
  }
  return mergeBars([], bars);
}

export function mergeBars(existing: QuoteBar[], incoming: QuoteBar[]): QuoteBar[] {
  const byDate = new Map<string, QuoteBar>();
  for (const bar of existing) byDate.set(dateKey(bar.time), bar);
  for (const bar of incoming) byDate.set(dateKey(bar.time), bar);
  return [...byDate.values()].sort((left, right) => left.time - right.time);
}

export function sliceBars(bars: QuoteBar[], range: string): QuoteBar[] {
  if (bars.length === 0) return [];
  const span = RANGE_MS[range] ?? RANGE_MS["6mo"];
  const end = bars[bars.length - 1].time;
  const start = end - span;
  return bars.filter((bar) => bar.time >= start);
}

export function changeFromBars(bars: QuoteBar[]): number | null {
  if (bars.length < 2) return null;
  const last = bars[bars.length - 1].close;
  const previous = bars[bars.length - 2].close;
  if (!previous) return null;
  return ((last - previous) / previous) * 100;
}

export function coversRange(bars: QuoteBar[], range: string): boolean {
  if (bars.length < 8) return false;
  const span = bars[bars.length - 1].time - bars[0].time;
  const needed = RANGE_MS[range] ?? RANGE_MS["6mo"];
  return span >= needed * 0.85;
}

export function isChartRange(value: string): value is ChartRange {
  return (CHART_RANGES as readonly string[]).includes(value);
}

export function resampleBars(bars: QuoteBar[], period: "month" | "year"): QuoteBar[] {
  const groups = new Map<string, QuoteBar[]>();
  for (const bar of bars) {
    const key = period === "year" ? String(new Date(bar.time).getUTCFullYear()) : dateKey(bar.time).slice(0, 7);
    const list = groups.get(key);
    if (list) list.push(bar);
    else groups.set(key, [bar]);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, list]) => ({
      time: list[0].time,
      open: list[0].open,
      high: Math.max(...list.map((bar) => bar.high)),
      low: Math.min(...list.map((bar) => bar.low)),
      close: list[list.length - 1].close,
    }));
}

export function chartBars(daily: QuoteBar[], monthly: QuoteBar[], range: string): QuoteBar[] {
  const mode: ChartRange = isChartRange(range) ? range : "daily";
  if (mode === "monthly") {
    const source = monthly.length >= 8 ? monthly : resampleBars(daily, "month");
    return sliceBars(source, CHART_SLICE.monthly);
  }
  if (mode === "yearly") {
    const source = monthly.length >= 8 ? monthly : resampleBars(daily, "month");
    return sliceBars(resampleBars(source, "year"), CHART_SLICE.yearly);
  }
  return sliceBars(daily, CHART_SLICE.daily);
}

export function klineCacheCovers(daily: QuoteBar[], monthly: QuoteBar[], range: string): boolean {
  if (range === "monthly" || range === "yearly") return monthly.length >= 8;
  return coversRange(daily, CHART_SLICE.daily);
}

function num(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10000) / 10000);
}
