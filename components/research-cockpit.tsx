"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, Pencil, Save, X } from "lucide-react";
import { ArticleMarkdown } from "@/components/article-markdown";
import { ArticleReader } from "@/components/article-reader";
import { MarkdownEditor } from "@/components/markdown-editor";
import { StockChart } from "@/components/stock-chart";
import { sourceLabel } from "@/lib/marketdata/cache-policy";
import type { QuoteSnapshot } from "@/lib/quote-types";
import type { ArticleSummary, ExpectationRow, StockCockpit } from "@/lib/vault/types";

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

function statusLabel(row: ExpectationRow) {
  if (row.statusKind === "met") return "达标";
  if (row.statusKind === "drift") return "偏差";
  if (row.statusKind === "miss") return "落空";
  if (row.statusKind === "pending") return "待验证";
  return row.status || "—";
}

function thesisMarkdown(summary: string, thesis: string) {
  if (!summary.trim() || /\[!summary\]/i.test(thesis)) return thesis;
  return `> [!summary] 一句话投资逻辑\n> ${summary.trim()}\n\n${thesis}`;
}

export function ResearchCockpit({ symbol, market, name }: Props) {
  const [data, setData] = useState<ResearchPayload | null>(null);
  const [quote, setQuote] = useState<QuoteSnapshot | null>(null);
  const [notes, setNotes] = useState<FocusNote[]>([]);
  const [range, setRange] = useState("daily");
  const [noteDate, setNoteDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [thesisError, setThesisError] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [composeSaving, setComposeSaving] = useState(false);
  const [openNote, setOpenNote] = useState<FocusNote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [articlePath, setArticlePath] = useState<string | null>(null);
  const [editingThesis, setEditingThesis] = useState(false);
  const [thesisDraft, setThesisDraft] = useState("");
  const [thesisSaving, setThesisSaving] = useState(false);
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
          setThesisDraft(research.stock?.thesis ?? "");
          setEditingThesis(false);
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
    const body = joinNoteHeading(noteTitle, noteBody);
    if (!body) return false;
    setNoteError(null);
    setComposeSaving(true);
    try {
      const res = await fetch("/api/focus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          market,
          notedAt: noteDate,
          body,
        }),
      });
      const json = (await res.json()) as FocusNote | { error?: string };
      if (!res.ok) {
        setNoteError("error" in json && json.error ? json.error : "记下失败。");
        return false;
      }
      setNoteTitle("");
      setNoteBody("");
      const list = await fetch(
        `/api/focus?symbol=${encodeURIComponent(symbol)}&market=${encodeURIComponent(market)}`,
      );
      const notesJson = (await list.json()) as FocusNote[];
      setNotes(Array.isArray(notesJson) ? notesJson : []);
      setComposing(false);
      return true;
    } catch {
      setNoteError("记下失败。");
      return false;
    } finally {
      setComposeSaving(false);
    }
  }

  async function saveThesis() {
    if (!thesisDraft.trim()) return;
    setThesisError(null);
    setThesisSaving(true);
    try {
      const res = await fetch("/api/research", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          market,
          thesis: thesisDraft.trim(),
        }),
      });
      const json = (await res.json()) as ResearchPayload & { error?: string };
      if (!res.ok) {
        setThesisError(json.error ?? "保存投资逻辑失败。");
        return;
      }
      setData(json);
      setThesisDraft(json.stock?.thesis ?? thesisDraft);
      setEditingThesis(false);
    } catch {
      setThesisError("保存投资逻辑失败。");
    } finally {
      setThesisSaving(false);
    }
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
      <section className="card quote-card">
        <div className="card-head">
          <h2>
            {displayName} <span>{symbol}</span>
          </h2>
          <div className="quote-head-meta">
            {quoteMeta ? (
              <span
                className="quote-asof"
                title="现价、市值、滚动PE 走东财；EV、远期PE、利润率、股息优先 Yahoo。"
              >
                {quoteMeta}
              </span>
            ) : null}
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
            <span title="过去 12 个月利润，可能混进去年好年景">滚动PE</span>
            <strong>{fmtNum(quote?.trailingPE ?? null, 1)}</strong>
          </div>
          <div>
            <span title="行情软件一致预期，季报后可能还没下修">远期PE</span>
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
      </section>

      <div className="cockpit-split">
        <section className="card kline-card">
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

        <section className="card focus-card">
          <div className="card-head focus-head">
            <h2>日志</h2>
            <div className="focus-actions">
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => {
                  setNoteDate(new Date().toISOString().slice(0, 10));
                  setNoteTitle("");
                  setNoteBody("");
                  setNoteError(null);
                  setComposing(true);
                }}
              >
                记下
              </button>
            </div>
          </div>
          <div className="focus-panel">
            {noteError && !composing ? <p className="quote-error">{noteError}</p> : null}
            {notes.length > 0 ? (
              <ul className="focus-list">
                {notes.map((note) => (
                  <li key={note.id}>
                    <button className="focus-note-hit" type="button" onClick={() => setOpenNote(note)}>
                      <span>{note.notedAt}</span>
                      <strong>{noteHeadline(note.body)}</strong>
                    </button>
                    <button className="focus-note-delete" type="button" onClick={() => removeNote(note.id)}>
                      删除
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted-copy focus-empty">还没有日志。点记下写一条，会存到 Stocks 里这只股票自己的日志文件。</p>
            )}
          </div>
        </section>
      </div>

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

      {stock ? (
        <section className="card thesis-card">
          <div className="card-head">
            <h2>投资逻辑</h2>
            <div className="article-reader-actions">
              {!editingThesis ? (
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    setThesisDraft(stock.thesis ?? "");
                    setEditingThesis(true);
                    setThesisError(null);
                  }}
                >
                  <Pencil size={14} />
                  编辑
                </button>
              ) : (
                <>
                  <button
                    className="btn btn-primary"
                    disabled={thesisSaving}
                    type="button"
                    onClick={() => void saveThesis()}
                  >
                    {thesisSaving ? <LoaderCircle className="spin" size={14} /> : <Save size={14} />}
                    {thesisSaving ? "保存中…" : "保存"}
                  </button>
                  <button
                    className="btn"
                    disabled={thesisSaving}
                    type="button"
                    onClick={() => {
                      setThesisDraft(stock.thesis ?? "");
                      setEditingThesis(false);
                    }}
                  >
                    取消
                  </button>
                </>
              )}
            </div>
          </div>
          {editingThesis ? (
            <div className="thesis-editor">
              {thesisError ? <p className="quote-error">{thesisError}</p> : null}
              <MarkdownEditor onChange={setThesisDraft} value={thesisDraft} />
            </div>
          ) : hasText(stock.thesis) || stock.summary || stock.valuations.length > 0 ? (
            <div className="article-markdown thesis-markdown">
              {hasText(stock.thesis) || stock.summary ? (
                <ArticleMarkdown value={thesisMarkdown(stock.summary, stock.thesis)} />
              ) : null}
              {stock.valuations.length > 0 && !/利润口径|估值记录/.test(stock.thesis) ? (
                <div className="valuation-panel">
                  <h5 className="article-h3">利润口径</h5>
                  <table className="article-table">
                    <thead>
                      <tr>
                        <th>口径</th>
                        <th>利润假设</th>
                        <th>对应 PE</th>
                        <th>怎么读</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stock.valuations.map((row) => (
                        <tr key={`${row.date}-${row.method}-${row.value}`}>
                          <td>{row.method || "—"}</td>
                          <td>{row.assumption || "—"}</td>
                          <td>{row.value || "—"}</td>
                          <td>{row.takeaway || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="muted-copy cockpit-empty-inline">还没有投资逻辑，点编辑写入 Vault 个股页。</p>
          )}
        </section>
      ) : null}

      {stock && stock.expectations.length > 0 ? (
        <section className="card">
          <div className="card-head">
            <h2>预期跟踪</h2>
            {stock.updatedAt ? <span className="quote-asof">{stock.updatedAt}</span> : null}
          </div>
          <div className="expectation-wrap">
            <table className="cockpit-table expectation-table">
              <colgroup>
                <col className="expectation-col-text" />
                <col className="expectation-col-when" />
                <col className="expectation-col-status" />
                <col className="expectation-col-result" />
              </colgroup>
              <thead>
                <tr>
                  <th>预期</th>
                  <th>时点</th>
                  <th>状态</th>
                  <th>实际结果</th>
                </tr>
              </thead>
              <tbody>
                {stock.expectations.map((row) => (
                  <tr key={`${row.text}-${row.deadline}`}>
                    <td>{row.text}</td>
                    <td>{row.deadline || "—"}</td>
                    <td>
                      <span className={`status-chip is-${row.statusKind}`}>{statusLabel(row)}</span>
                    </td>
                    <td>{row.result || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

      {composing ? (
        <FocusNoteComposer
          date={noteDate}
          title={noteTitle}
          body={noteBody}
          saving={composeSaving}
          error={noteError}
          onDate={setNoteDate}
          onTitle={setNoteTitle}
          onBody={setNoteBody}
          onSave={() => void addNote()}
          onClose={() => {
            if (composeSaving) return;
            setComposing(false);
            setNoteError(null);
            setNoteTitle("");
            setNoteBody("");
          }}
        />
      ) : null}

      {openNote ? (
        <FocusNoteReader
          note={openNote}
          symbol={symbol}
          market={market}
          onClose={() => setOpenNote(null)}
          onSaved={(saved) => {
            setNotes((prev) => prev.map((item) => (item.id === openNote.id ? saved : item)));
            setOpenNote(saved);
          }}
        />
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

function splitNoteHeading(markdown: string) {
  const text = markdown.replace(/\r\n/g, "\n").trim();
  const match = text.match(/^#\s+(.+)\n*(?:[\n\r]+)?([\s\S]*)$/);
  if (!match) return { title: "", body: text };
  return { title: match[1].trim(), body: (match[2] ?? "").trim() };
}

function joinNoteHeading(title: string, body: string) {
  const heading = title.trim();
  const text = body.replace(/\r\n/g, "\n").trim();
  if (!heading) return text;
  return text ? `# ${heading}\n\n${text}` : `# ${heading}`;
}

function noteHeadline(body: string) {
  const { title, body: rest } = splitNoteHeading(body);
  const raw =
    title ||
    rest
      .split("\n")
      .find((line) => line.trim())
      ?.trim()
      .replace(/^#+\s+/, "")
      .replace(/\*\*/g, "") ||
    "日志";
  return raw.length > 48 ? `${raw.slice(0, 48)}…` : raw;
}

function FocusNoteComposer({
  date,
  title,
  body,
  saving,
  error,
  onDate,
  onTitle,
  onBody,
  onSave,
  onClose,
}: {
  date: string;
  title: string;
  body: string;
  saving: boolean;
  error: string | null;
  onDate: (value: string) => void;
  onTitle: (value: string) => void;
  onBody: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        aria-modal="true"
        className="modal article-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="modal-head note-composer-head">
          <div className="note-meta-row">
            <input
              aria-label="标题"
              className="note-title-input"
              onChange={(event) => onTitle(event.target.value)}
              placeholder="标题"
              value={title}
            />
            <input
              aria-label="日期"
              className="focus-date"
              onChange={(event) => onDate(event.target.value)}
              type="date"
              value={date}
            />
          </div>
          <div className="article-reader-actions">
            <button
              className="btn btn-primary"
              disabled={saving || (!title.trim() && !body.trim())}
              type="button"
              onClick={onSave}
            >
              {saving ? <LoaderCircle className="spin" size={14} /> : <Save size={14} />}
              {saving ? "保存中…" : "保存"}
            </button>
            <button className="btn" disabled={saving} type="button" onClick={onClose}>
              取消
            </button>
            <button aria-label="关闭" type="button" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="article-body">
          {error ? <div className="inline-error">{error}</div> : null}
          <MarkdownEditor
            onChange={onBody}
            placeholder="当天看法，写入 Stocks 里这只股票的日志文件。支持粗体、列表。"
            value={body}
          />
        </div>
      </div>
    </div>
  );
}

function FocusNoteReader({
  note,
  symbol,
  market,
  onClose,
  onSaved,
}: {
  note: FocusNote;
  symbol: string;
  market: string;
  onClose: () => void;
  onSaved: (note: FocusNote) => void;
}) {
  const parsed = splitNoteHeading(note.body);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateDraft, setDateDraft] = useState(note.notedAt);
  const [titleDraft, setTitleDraft] = useState(parsed.title);
  const [bodyDraft, setBodyDraft] = useState(parsed.body);

  useEffect(() => {
    const next = splitNoteHeading(note.body);
    setEditing(false);
    setError(null);
    setDateDraft(note.notedAt);
    setTitleDraft(next.title);
    setBodyDraft(next.body);
  }, [note.id, note.notedAt, note.body]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (editing) {
        const next = splitNoteHeading(note.body);
        setDateDraft(note.notedAt);
        setTitleDraft(next.title);
        setBodyDraft(next.body);
        setEditing(false);
        setError(null);
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, note.body, note.notedAt, onClose]);

  async function saveDraft() {
    const body = joinNoteHeading(titleDraft, bodyDraft);
    if (!body) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/focus/${encodeURIComponent(note.id)}?symbol=${encodeURIComponent(symbol)}&market=${encodeURIComponent(market)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            notedAt: dateDraft,
            body,
          }),
        },
      );
      const json = (await res.json()) as FocusNote | { error?: string };
      if (!res.ok) {
        setError("error" in json && json.error ? json.error : "保存失败。");
        return;
      }
      onSaved(json as FocusNote);
      setEditing(false);
    } catch {
      setError("保存失败。");
    } finally {
      setSaving(false);
    }
  }

  function resetDraft() {
    const next = splitNoteHeading(note.body);
    setDateDraft(note.notedAt);
    setTitleDraft(next.title);
    setBodyDraft(next.body);
    setEditing(false);
    setError(null);
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={() => {
        if (!editing) onClose();
      }}
    >
      <div
        aria-modal="true"
        className="modal article-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className={editing ? "modal-head note-composer-head" : "modal-head"}>
          {editing ? (
            <div className="note-meta-row">
              <input
                aria-label="标题"
                className="note-title-input"
                onChange={(event) => setTitleDraft(event.target.value)}
                placeholder="标题"
                value={titleDraft}
              />
              <input
                aria-label="日期"
                className="focus-date"
                onChange={(event) => setDateDraft(event.target.value)}
                type="date"
                value={dateDraft}
              />
            </div>
          ) : (
            <div>
              <h2>{noteHeadline(note.body)}</h2>
              <p className="article-meta">{note.notedAt}</p>
            </div>
          )}
          <div className="article-reader-actions">
            {!editing ? (
              <button
                className="btn"
                type="button"
                onClick={() => {
                  const next = splitNoteHeading(note.body);
                  setDateDraft(note.notedAt);
                  setTitleDraft(next.title);
                  setBodyDraft(next.body);
                  setEditing(true);
                  setError(null);
                }}
              >
                <Pencil size={14} />
                编辑
              </button>
            ) : (
              <>
                <button
                  className="btn btn-primary"
                  disabled={saving || (!titleDraft.trim() && !bodyDraft.trim())}
                  type="button"
                  onClick={() => void saveDraft()}
                >
                  {saving ? <LoaderCircle className="spin" size={14} /> : <Save size={14} />}
                  {saving ? "保存中…" : "保存"}
                </button>
                <button className="btn" disabled={saving} type="button" onClick={resetDraft}>
                  取消
                </button>
              </>
            )}
            <button aria-label="关闭" type="button" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="article-body">
          {error ? <div className="inline-error">{error}</div> : null}
          {editing ? (
            <MarkdownEditor onChange={setBodyDraft} value={bodyDraft} />
          ) : (
            <div className="article-markdown">
              <ArticleMarkdown value={splitNoteHeading(note.body).body || note.body} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
