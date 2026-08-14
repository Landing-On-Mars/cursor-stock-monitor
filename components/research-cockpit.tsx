"use client";

import { useEffect, useState } from "react";
import { StockChart } from "@/components/stock-chart";
import type { QuoteSnapshot } from "@/lib/quote-types";
import type { ArticleSummary, StockCockpit } from "@/lib/vault/types";

type Props = {
  symbol: string;
  market: string;
  name?: string;
};

type ResearchPayload = {
  found: boolean;
  vault: { ok: boolean };
  stock: StockCockpit | null;
  articles: ArticleSummary[];
  cursorPrompt: string;
};

type FocusNote = {
  id: number;
  notedAt: string;
  body: string;
};

function hasText(value?: string | null) {
  return Boolean(
    value
      ?.replace(/^#+\s.*$/gm, "")
      .replace(/[-*_>|`]/g, "")
      .trim(),
  );
}

function fmtCap(n: number | null) {
  if (n == null) return "—";
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}万亿`;
  if (n >= 1e8) return `${(n / 1e8).toFixed(2)}亿`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  return n.toLocaleString();
}

function fmtNum(n: number | null, digits = 2) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(digits);
}

function fmtYield(n: number | null) {
  if (n == null || Number.isNaN(n)) return "—";
  const pct = n <= 1 ? n * 100 : n;
  return `${pct.toFixed(2)}%`;
}

export function ResearchCockpit({ symbol, market, name }: Props) {
  const [data, setData] = useState<ResearchPayload | null>(null);
  const [quote, setQuote] = useState<QuoteSnapshot | null>(null);
  const [notes, setNotes] = useState<FocusNote[]>([]);
  const [range, setRange] = useState("6mo");
  const [noteDate, setNoteDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [noteBody, setNoteBody] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch(`/api/research?symbol=${encodeURIComponent(symbol)}&market=${encodeURIComponent(market)}`),
      fetch(`/api/focus?symbol=${encodeURIComponent(symbol)}&market=${encodeURIComponent(market)}`),
    ])
      .then(async ([researchRes, focusRes]) => {
        const research = (await researchRes.json()) as ResearchPayload & { error?: string };
        const focusJson = (await focusRes.json()) as FocusNote[] | { error?: string };
        if (!active) return;
        if (!researchRes.ok) {
          setError(research.error ?? "读取失败");
          setData(null);
        } else {
          setError(null);
          setData(research);
        }
        setNotes(Array.isArray(focusJson) ? focusJson : []);
      })
      .catch(() => {
        if (active) setError("读取失败");
      });
    return () => {
      active = false;
    };
  }, [symbol, market]);

  useEffect(() => {
    let active = true;
    fetch(
      `/api/quotes?symbol=${encodeURIComponent(symbol)}&market=${encodeURIComponent(market)}&range=${encodeURIComponent(range)}`,
    )
      .then((res) => res.json() as Promise<QuoteSnapshot>)
      .then((json) => {
        if (active) setQuote(json);
      })
      .catch(() => {
        if (active) setQuote(null);
      });
    return () => {
      active = false;
    };
  }, [symbol, market, range]);

  async function addNote() {
    if (!noteBody.trim()) return;
    const res = await fetch("/api/focus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbol,
        market,
        notedAt: noteDate,
        body: noteBody.trim(),
      }),
    });
    if (!res.ok) return;
    setNoteBody("");
    const list = await fetch(
      `/api/focus?symbol=${encodeURIComponent(symbol)}&market=${encodeURIComponent(market)}`,
    );
    const json = (await list.json()) as FocusNote[];
    setNotes(Array.isArray(json) ? json : []);
  }

  async function removeNote(id: number) {
    await fetch(`/api/focus/${id}`, { method: "DELETE" });
    setNotes((prev) => prev.filter((note) => note.id !== id));
  }

  async function copyPrompt() {
    if (!data?.cursorPrompt) return;
    await navigator.clipboard.writeText(data.cursorPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (error) {
    return (
      <section className="card cockpit-empty">
        <p>{error}</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="card cockpit-empty">
        <p className="muted-copy">正在读取 {symbol}…</p>
      </section>
    );
  }

  const stock = data.stock;
  const displayName = stock?.name || name || symbol;
  const up = (quote?.changePercent ?? 0) >= 0;

  return (
    <div className="cockpit-stack">
      <div className="cockpit-split">
        <section className="card quote-card">
          <div className="card-head">
            <h2>
              {displayName} <span>{symbol}</span>
            </h2>
            {quote?.asOf ? (
              <span className="quote-asof">{quote.stale ? `缓存 ${quote.asOf}` : quote.asOf}</span>
            ) : null}
          </div>
          <div className="quote-grid">
            <div>
              <span>现价</span>
              <strong className={up ? "up" : "down"}>{fmtNum(quote?.price ?? null)}</strong>
            </div>
            <div>
              <span>涨跌</span>
              <strong className={up ? "up" : "down"}>
                {quote?.changePercent != null ? `${quote.changePercent.toFixed(2)}%` : "—"}
              </strong>
            </div>
            <div>
              <span>市值</span>
              <strong>{fmtCap(quote?.marketCap ?? null)}</strong>
            </div>
            <div>
              <span>PE</span>
              <strong>{fmtNum(quote?.trailingPE ?? null, 1)}</strong>
            </div>
            <div>
              <span>远期PE</span>
              <strong>{fmtNum(quote?.forwardPE ?? null, 1)}</strong>
            </div>
            <div>
              <span>PB</span>
              <strong>{fmtNum(quote?.priceToBook ?? null)}</strong>
            </div>
            <div>
              <span>EPS</span>
              <strong>{fmtNum(quote?.eps ?? null)}</strong>
            </div>
            <div>
              <span>股息率</span>
              <strong>{fmtYield(quote?.dividendYield ?? null)}</strong>
            </div>
          </div>
        </section>

        <section className="card focus-card">
          <div className="card-head focus-head">
            <h2>现在该看什么</h2>
            <div className="focus-actions">
              <input
                className="focus-date"
                type="date"
                value={noteDate}
                onChange={(event) => setNoteDate(event.target.value)}
              />
              <button className="btn btn-primary" type="button" onClick={addNote}>
                记下
              </button>
            </div>
          </div>
          <div className="focus-panel">
            <textarea
              rows={5}
              placeholder="跟踪点"
              value={noteBody}
              onChange={(event) => setNoteBody(event.target.value)}
            />
            {notes.length > 0 ? (
              <ul className="focus-list">
                {notes.map((note) => (
                  <li key={note.id}>
                    <time>{note.notedAt}</time>
                    <p>{note.body}</p>
                    <button type="button" onClick={() => removeNote(note.id)}>
                      删除
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>K 线</h2>
          {quote?.fromCache ? <span className="quote-asof">本地</span> : null}
        </div>
        <div className="cockpit-pad">
          <StockChart bars={quote?.bars ?? []} range={range} onRange={setRange} />
        </div>
      </section>

      {data.articles.length > 0 ? (
        <section className="card">
          <div className="card-head">
            <h2>关联文章</h2>
          </div>
          <ul className="article-list">
            {data.articles.map((article) => (
              <li key={article.path}>
                <strong>{article.title}</strong>
                <span>
                  {article.publishedAt || "无日期"}
                  {article.source ? ` · ${article.source}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {hasText(stock?.thesis) ? (
        <section className="card">
          <div className="card-head">
            <h2>投资逻辑</h2>
          </div>
          <pre className="thesis-body">{stock?.thesis}</pre>
        </section>
      ) : null}

      {stock && stock.expectations.length > 0 ? (
        <section className="card">
          <div className="card-head">
            <h2>预期跟踪</h2>
          </div>
          <ul className="metric-list">
            {stock.expectations.map((row) => (
              <li key={`${row.text}-${row.deadline}`}>
                {row.text}
                {row.deadline ? ` · ${row.deadline}` : ""}
                {row.status ? ` · ${row.status}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.cursorPrompt ? (
        <section className="card cursor-prompt-card">
          <div className="card-head">
            <h2>丢给 Cursor 的提示词</h2>
            <button className="btn" type="button" onClick={copyPrompt}>
              {copied ? "已复制" : "复制"}
            </button>
          </div>
          <pre className="cursor-prompt">{data.cursorPrompt}</pre>
        </section>
      ) : null}
    </div>
  );
}
