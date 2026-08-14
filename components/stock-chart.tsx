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

const PLOT = { left: 8, right: 792, top: 8, bottom: 188 };

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
        <div className="kline-frame">
          <div className="kline-y">
            {drawing.yTicks.map((tick) => (
              <span key={tick.label}>{tick.label}</span>
            ))}
          </div>
          <div className="kline-plot">
            <svg className="kline-svg" viewBox="0 0 800 196" role="img" aria-label="日线 K 线">
              <g className="chart-grid">
                {drawing.yTicks.map((tick) => (
                  <line key={tick.y} x1={PLOT.left} x2={PLOT.right} y1={tick.y} y2={tick.y} />
                ))}
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
            <div className="kline-x">
              {drawing.xTicks.map((tick) => (
                <span key={tick.label}>{tick.label}</span>
              ))}
            </div>
          </div>
        </div>
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
  const plotWidth = PLOT.right - PLOT.left;
  const plotHeight = PLOT.bottom - PLOT.top;
  const width = Math.max(2, Math.min(7, plotWidth / bars.length - 1.2));
  const step = plotWidth / Math.max(bars.length - 1, 1);
  const project = (value: number) => PLOT.bottom - ((value - min) / span) * plotHeight;
  const yValues = [max, max - span / 3, min + span / 3, min];

  return {
    candles: bars.map((bar, index) => {
      const x = PLOT.left + index * step;
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
    yTicks: yValues.map((value, index) => ({
      y: project(value),
      label: formatPrice(value),
      key: `${index}-${formatPrice(value)}`,
    })),
    xTicks: [
      { label: formatDate(bars[0].time) },
      { label: formatDate(bars[Math.floor(bars.length / 2)].time) },
      { label: formatDate(bars[bars.length - 1].time) },
    ],
  };
}

function formatPrice(value: number) {
  if (value >= 1000) return value.toFixed(0);
  if (value >= 100) return value.toFixed(1);
  return value.toFixed(2);
}

function formatDate(time: number) {
  const date = new Date(time);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}-${day}`;
}
