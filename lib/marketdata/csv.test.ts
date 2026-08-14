import assert from "node:assert/strict";
import test from "node:test";
import {
  barsToCsv,
  coversRange,
  csvToBars,
  dateKey,
  mergeBars,
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
