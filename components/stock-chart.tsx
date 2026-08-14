"use client";

import { useMemo } from "react";
import type { QuoteBar } from "@/lib/quote-types";

type StockChartProps = {
  bars: QuoteBar[];
  range: string;
  onRange: (range: string) => void;
};

const ranges = [
  ["1mo", "1月"],
  ["3mo", "3月"],
  ["6mo", "6月"],
  ["1y", "1年"],
];

export function StockChart({ bars, range, onRange }: StockChartProps) {
  const drawing = useMemo(() => buildCandles(bars), [bars]);

  return (
    <div className="kline">
      <div className="chart-tabs">
        {ranges.map(([value, label]) => (
          <button
            className={range === value ? "active" : ""}
            key={value}
            onClick={() => onRange(value)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      {drawing ? (
        <svg className="kline-svg" viewBox="0 0 800 220" role="img" aria-label="日线 K 线">
          <g className="chart-grid">
            <line x1="0" y1="20" x2="800" y2="20" />
            <line x1="0" y1="80" x2="800" y2="80" />
            <line x1="0" y1="140" x2="800" y2="140" />
            <line x1="0" y1="200" x2="800" y2="200" />
          </g>
          {drawing.candles.map((candle) => (
            <g key={candle.time}>
              <line
                x1={candle.x}
                x2={candle.x}
                y1={candle.high}
                y2={candle.low}
                stroke={candle.up ? "#c64c4c" : "#235c45"}
                strokeWidth="1"
              />
              <rect
                x={candle.x - candle.width / 2}
                y={Math.min(candle.open, candle.close)}
                width={candle.width}
                height={Math.max(1.4, Math.abs(candle.close - candle.open))}
                fill={candle.up ? "#c64c4c" : "#235c45"}
              />
            </g>
          ))}
        </svg>
      ) : (
        <p className="cockpit-empty-inline">没有可用的 K 线数据。</p>
      )}
    </div>
  );
}

function buildCandles(bars: QuoteBar[]) {
  if (bars.length === 0) return null;
  const highs = bars.map((bar) => bar.high);
  const lows = bars.map((bar) => bar.low);
  const max = Math.max(...highs);
  const min = Math.min(...lows);
  const span = max - min || 1;
  const width = Math.max(2, Math.min(7, 760 / bars.length - 1.4));
  const step = 760 / Math.max(bars.length - 1, 1);

  return {
    candles: bars.map((bar, index) => {
      const x = 20 + index * step;
      const project = (value: number) => 200 - ((value - min) / span) * 180;
      return {
        time: bar.time,
        x,
        width,
        high: project(bar.high),
        low: project(bar.low),
        open: project(bar.open),
        close: project(bar.close),
        up: bar.close >= bar.open,
      };
    }),
  };
}
