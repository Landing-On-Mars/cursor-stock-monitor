"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { ArticleReader } from "@/components/article-reader";
import { StockChart } from "@/components/stock-chart";
import { sourceLabel } from "@/lib/marketdata/cache-policy";
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
  id: string;
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
  const [noteError, setNoteError] = useState<string | null>(null);
  const [openNote, setOpenNote] = useState<FocusNote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [articlePath, setArticlePath] = useState<string | null>(null);
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

  const fetchQuote = useCallback(async (force: boolean) => {
    const params = new URLSearchParams({ symbol, market, range });
    if (force) params.set("force", "1");
    const res = await fetch(`/api/quotes?${params.toString()}`, { cache: "no-store" });
    return (await res.json()) as QuoteSnapshot;
  }, [symbol, market, range]);

  const refreshQuote = useCallback(async () => {
    setQuoteLoading(true);
    try {
      setQuote(await fetchQuote(true));
    } catch {
      setQuote(null);
    } finally {
      setQuoteLoading(false);
    }
  }, [fetchQuote]);

  useEffect(() => {
    let active = true;
    void (async () => {
      setQuoteLoading(true);
      try {
        const json = await fetchQuote(false);
        if (!active) return;
        setQuote(json);
        if (json.fromCache && json.marketCap == null) {
          const fresh = await fetchQuote(true);
          if (active) setQuote(fresh);
        }
      } catch {
        if (active) setQuote(null);
      } finally {
        if (active) setQuoteLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [fetchQuote]);

  async function addNote() {
    if (!noteBody.trim()) return;
    setNoteError(null);
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
    const json = (await res.json()) as FocusNote | { error?: string };
    if (!res.ok) {
      setNoteError("error" in json && json.error ? json.error : "记下失败。");
      return;
    }
    setNoteBody("");
    const list = await fetch(
      `/api/focus?symbol=${encodeURIComponent(symbol)}&market=${encodeURIComponent(market)}`,
    );
    const notesJson = (await list.json()) as FocusNote[];
    setNotes(Array.isArray(notesJson) ? notesJson : []);
  }

  async function removeNote(id: string) {
    setNoteError(null);
    const res = await fetch(
      `/api/focus/${encodeURIComponent(id)}?symbol=${encodeURIComponent(symbol)}&market=${encodeURIComponent(market)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      setNoteError(json.error ?? "删除失败。");
      return;
    }
    setNotes((prev) => prev.filter((note) => note.id !== id));
    setOpenNote((current) => (current?.id === id ? null : current));
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
  const quoteMeta = [quote?.asOf, sourceLabel(quote?.source, quote?.fromCache, quote?.stale)]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="cockpit-stack">
      <div className="cockpit-split">
        <section className="card quote-card">
          <div className="card-head">
            <h2>
              {displayName} <span>{symbol}</span>
            </h2>
            <div className="quote-head-meta">
              {quoteMeta ? <span className="quote-asof">{quoteMeta}</span> : null}
              <button className="btn" type="button" disabled={quoteLoading} onClick={() => void refreshQuote()}>
                {quoteLoading ? "刷新中" : "刷新"}
              </button>
            </div>
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
              <span>企业价值</span>
              <strong>{fmtCap(quote?.enterpriseValue ?? null)}</strong>
            </div>
            <div>
              <span>滚动PE</span>
              <strong>{fmtNum(quote?.trailingPE ?? null, 1)}</strong>
            </div>
            <div>
              <span>远期PE</span>
              <strong>{fmtNum(quote?.forwardPE ?? null, 1)}</strong>
            </div>
            <div>
              <span>EV/EBITDA</span>
              <strong>{fmtNum(quote?.enterpriseToEbitda ?? null, 1)}</strong>
            </div>
            <div>
              <span>净利率</span>
              <strong>{fmtYield(quote?.profitMargin ?? null)}</strong>
            </div>
            <div>
              <span>营业利润率</span>
              <strong>{fmtYield(quote?.operatingMargin ?? null)}</strong>
            </div>
            <div>
              <span>远期股息率</span>
              <strong>{fmtYield(quote?.forwardDividendYield ?? quote?.dividendYield ?? null)}</strong>
            </div>
          </div>
          {quote?.error ? <p className="quote-error">{quote.error}</p> : null}
          {market !== "US" ? (
            <p className="quote-hint">
              现价、市值、滚动PE 走东财；EV、远期PE、利润率、股息优先 Yahoo。Yahoo 不通时用东财财报补利润率和股息。
            </p>
          ) : null}
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
              placeholder="当天观察，写入 Vault 个股页"
              value={noteBody}
              onChange={(event) => setNoteBody(event.target.value)}
            />
            {noteError ? <p className="quote-error">{noteError}</p> : null}
            {notes.length > 0 ? (
              <ul className="focus-list">
                {notes.map((note) => (
                  <li key={note.id}>
                    <button className="focus-note-hit" type="button" onClick={() => setOpenNote(note)}>
                      <strong>{notePreview(note.body)}</strong>
                      <span>{note.notedAt}</span>
                    </button>
                    <button className="focus-note-delete" type="button" onClick={() => removeNote(note.id)}>
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
          {quote?.fromCache ? (
            <span className="quote-asof">{quote.stale ? "过期缓存" : "本地缓存"}</span>
          ) : null}
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
                <button className="article-hit" type="button" onClick={() => setArticlePath(article.path)}>
                  <strong>{article.title}</strong>
                  <span>
                    {article.publishedAt || "无日期"}
                    {article.source ? ` · ${article.source}` : ""}
                  </span>
                </button>
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

      {openNote ? (
        <FocusNoteReader note={openNote} onClose={() => setOpenNote(null)} />
      ) : null}

      {articlePath ? (
        <ArticleReader
          key={articlePath}
          path={articlePath}
          onClose={() => setArticlePath(null)}
          onSaved={(saved) => {
            setData((prev) =>
              prev
                ? {
                    ...prev,
                    articles: prev.articles.map((item) =>
                      item.path === saved.path
                        ? {
                            ...item,
                            title: saved.title,
                            source: saved.source,
                            publishedAt: saved.publishedAt,
                            status: saved.status,
                          }
                        : item,
                    ),
                  }
                : prev,
            );
          }}
        />
      ) : null}
    </div>
  );
}

function notePreview(body: string) {
  return body.replace(/\s+/g, " ").trim();
}

function noteTitle(body: string) {
  const first = body.split("\n").find((line) => line.trim())?.trim() || "观察";
  return first.length > 48 ? `${first.slice(0, 48)}…` : first;
}

function FocusNoteReader({ note, onClose }: { note: FocusNote; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        aria-modal="true"
        className="modal article-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="modal-head">
          <div>
            <h2>{noteTitle(note.body)}</h2>
            <p className="article-meta">{note.notedAt}</p>
          </div>
          <div className="article-reader-actions">
            <button aria-label="关闭" type="button" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="article-body">
          <pre className="focus-note-copy">{note.body}</pre>
        </div>
      </div>
    </div>
  );
}
