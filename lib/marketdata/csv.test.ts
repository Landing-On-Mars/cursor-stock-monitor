import assert from "node:assert/strict";
import test from "node:test";
import {
  barsToCsv,
  chartBars,
  coversRange,
  csvToBars,
  dateKey,
  klineCacheCovers,
  mergeBars,
  resampleBars,
  sliceBars,
  timeFromDateKey,
} from "./csv";

const sample = [
  { time: timeFromDateKey("2026-01-02"), open: 10, high: 11, low: 9.5, close: 10.5 },
  { time: timeFromDateKey("2026-01-05"), open: 10.5, high: 12, low: 10.4, close: 11.8 },
];

test("csv round-trips daily bars by UTC date", () => {
  const parsed = csvToBars(barsToCsv(sample));
  assert.equal(parsed.length, 2);
  assert.equal(dateKey(parsed[0].time), "2026-01-02");
  assert.equal(parsed[1].close, 11.8);
});

test("merge keeps the newer bar for the same date", () => {
  const merged = mergeBars(sample, [
    { time: timeFromDateKey("2026-01-05"), open: 10.6, high: 12.2, low: 10.4, close: 12 },
    { time: timeFromDateKey("2026-01-06"), open: 12, high: 12.4, low: 11.9, close: 12.1 },
  ]);
  assert.equal(merged.length, 3);
  assert.equal(merged[1].close, 12);
  assert.equal(dateKey(merged[2].time), "2026-01-06");
});

test("slice keeps the requested window from the last bar", () => {
  const bars = [];
  for (let day = 1; day <= 40; day += 1) {
    bars.push({
      time: Date.UTC(2026, 0, day),
      open: day,
      high: day + 1,
      low: day - 1,
      close: day,
    });
  }
  const month = sliceBars(bars, "1mo");
  assert.ok(month.length < bars.length);
  assert.equal(dateKey(month[month.length - 1].time), dateKey(bars[bars.length - 1].time));
  assert.equal(coversRange(bars, "1mo"), true);
  assert.equal(coversRange(sample, "1y"), false);
});

test("resample collapses daily bars into monthly and yearly candles", () => {
  const daily = [
    { time: timeFromDateKey("2024-01-02"), open: 10, high: 12, low: 9, close: 11 },
    { time: timeFromDateKey("2024-01-31"), open: 11, high: 13, low: 10, close: 12 },
    { time: timeFromDateKey("2024-02-01"), open: 12, high: 14, low: 11, close: 13 },
    { time: timeFromDateKey("2025-03-03"), open: 13, high: 15, low: 12, close: 14 },
  ];
  const monthly = resampleBars(daily, "month");
  assert.equal(monthly.length, 3);
  assert.equal(dateKey(monthly[0].time), "2024-01-02");
  assert.equal(monthly[0].open, 10);
  assert.equal(monthly[0].high, 13);
  assert.equal(monthly[0].low, 9);
  assert.equal(monthly[0].close, 12);

  const yearly = resampleBars(monthly, "year");
  assert.equal(yearly.length, 2);
  assert.equal(yearly[0].open, 10);
  assert.equal(yearly[0].close, 13);
  assert.equal(yearly[1].close, 14);
});

test("chart windows keep about one year of daily and a decade of monthly", () => {
  const daily = [];
  for (let day = 0; day < 500; day += 1) {
    daily.push({
      time: Date.UTC(2024, 0, 1) + day * 86_400_000,
      open: 10,
      high: 11,
      low: 9,
      close: 10,
    });
  }
  const monthly = [];
  for (let month = 0; month < 180; month += 1) {
    monthly.push({
      time: Date.UTC(2011, month, 1),
      open: 10,
      high: 11,
      low: 9,
      close: 10,
    });
  }
  const dayBars = chartBars(daily, monthly, "daily");
  const monthBars = chartBars(daily, monthly, "monthly");
  const yearBars = chartBars(daily, monthly, "yearly");
  assert.ok(dayBars.length > 300 && dayBars.length < 430);
  assert.ok(monthBars.length >= 110 && monthBars.length <= 130);
  assert.ok(yearBars.length >= 14 && yearBars.length <= 16);
  assert.equal(klineCacheCovers(daily, monthly, "daily"), true);
  assert.equal(klineCacheCovers(daily, [], "monthly"), false);
  assert.equal(klineCacheCovers(daily, monthly, "yearly"), true);
});
