"use client";

import {
  ArrowRightLeft,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  type Market,
  type WatchlistCategory,
  type WatchlistItem,
} from "@/lib/watchlist-types";

const categoryText: Record<WatchlistCategory, string> = {
  CORE: "核心",
  WATCH: "观察",
};

const marketText: Record<Market, string> = {
  US: "美股",
  HK: "港股",
  CN: "A股",
};

type FormState = {
  symbol: string;
  name: string;
  market: Market;
  category: WatchlistCategory;
  note: string;
};

const emptyForm: FormState = {
  symbol: "",
  name: "",
  market: "US",
  category: "WATCH",
  note: "",
};

async function readError(response: Response) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? "操作失败，请稍后重试。";
}

export function WatchlistManager() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [category, setCategory] = useState<WatchlistCategory>("CORE");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    let active = true;

    fetch("/api/watchlist", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(await readError(response));
        return response.json() as Promise<WatchlistItem[]>;
      })
      .then((data) => {
        if (!active) return;
        setItems(data);
        setError("");
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        setError(requestError instanceof Error ? requestError.message : "自选股加载失败。");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const counts = useMemo(
    () => ({
      CORE: items.filter((item) => item.category === "CORE").length,
      WATCH: items.filter((item) => item.category === "WATCH").length,
    }),
    [items],
  );

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter(
      (item) =>
        item.category === category &&
        (!normalizedQuery ||
          item.symbol.toLowerCase().includes(normalizedQuery) ||
          item.name.toLowerCase().includes(normalizedQuery)),
    );
  }, [category, items, query]);

  function openCreateForm() {
    setForm({ ...emptyForm, category });
    setError("");
    setModalOpen(true);
  }

  async function createItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error(await readError(response));

      const item = (await response.json()) as WatchlistItem;
      setItems((current) => [...current, item]);
      setCategory(item.category);
      setModalOpen(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "添加失败。");
    } finally {
      setSubmitting(false);
    }
  }

  async function moveItem(item: WatchlistItem) {
    const nextCategory: WatchlistCategory =
      item.category === "CORE" ? "WATCH" : "CORE";
    setBusyId(item.id);
    setError("");

    try {
      const response = await fetch(`/api/watchlist/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: nextCategory }),
      });
      if (!response.ok) throw new Error(await readError(response));

      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, category: nextCategory } : entry,
        ),
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "移动失败。");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteItem(item: WatchlistItem) {
    if (!window.confirm(`确定从自选股中删除 ${item.name}（${item.symbol}）吗？`)) {
      return;
    }

    setBusyId(item.id);
    setError("");

    try {
      const response = await fetch(`/api/watchlist/${item.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(await readError(response));
      setItems((current) => current.filter((entry) => entry.id !== item.id));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "删除失败。");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <section className="card watchlist-manager">
        <div className="card-head">
          <div>
            <h2>我的自选股</h2>
            <p>核心标的重点跟踪，观察标的等待条件成熟</p>
          </div>
          <button className="btn btn-primary" onClick={openCreateForm}>
            <Plus size={14} />添加股票
          </button>
        </div>

        <div className="watchlist-controls">
          <div className="segment-control">
            {(["CORE", "WATCH"] as const).map((value) => (
              <button
                className={category === value ? "active" : ""}
                key={value}
                onClick={() => setCategory(value)}
              >
                {value === "CORE" && <Star size={13} />}
                {categoryText[value]}
                <span>{counts[value]}</span>
              </button>
            ))}
          </div>
          <label className="watchlist-search">
            <Search size={14} />
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索代码或名称"
              value={query}
            />
          </label>
        </div>

        {error && !modalOpen && <div className="inline-error">{error}</div>}

        <div className="managed-watchlist">
          {loading ? (
            <div className="watchlist-empty">正在加载自选股…</div>
          ) : visibleItems.length === 0 ? (
            <div className="watchlist-empty">
              <Star size={20} />
              <strong>这个分组还没有股票</strong>
              <span>添加一只股票，开始建立你的研究列表。</span>
            </div>
          ) : (
            visibleItems.map((item) => (
              <div className="managed-watch-row" key={item.id}>
                <span className={`market-icon market-${item.market.toLowerCase()}`}>
                  {item.market}
                </span>
                <div className="managed-watch-symbol">
                  <strong>{item.symbol}</strong>
                  <span>{marketText[item.market]}</span>
                </div>
                <div className="managed-watch-name">
                  <strong>{item.name}</strong>
                  <span>{item.note || "暂未添加跟踪备注"}</span>
                </div>
                <span className={`watch-category watch-category-${item.category.toLowerCase()}`}>
                  {categoryText[item.category]}
                </span>
                <div className="row-actions">
                  <button
                    disabled={busyId === item.id}
                    onClick={() => void moveItem(item)}
                    title={`移动到${categoryText[item.category === "CORE" ? "WATCH" : "CORE"]}`}
                  >
                    <ArrowRightLeft size={14} />
                  </button>
                  <button
                    className="danger-action"
                    disabled={busyId === item.id}
                    onClick={() => void deleteItem(item)}
                    title="删除"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {modalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setModalOpen(false)}>
          <div
            aria-labelledby="add-stock-title"
            aria-modal="true"
            className="modal"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="modal-head">
              <div><h2 id="add-stock-title">添加自选股</h2><p>行情自动搜索将在接入数据源后开放</p></div>
              <button onClick={() => setModalOpen(false)} aria-label="关闭"><X size={18} /></button>
            </div>
            <form onSubmit={createItem}>
              <div className="form-grid">
                <label className="field">
                  <span>股票代码</span>
                  <input
                    autoFocus
                    onChange={(event) => setForm({ ...form, symbol: event.target.value })}
                    placeholder="例如 AAPL、0700、600519"
                    required
                    value={form.symbol}
                  />
                </label>
                <label className="field">
                  <span>股票名称</span>
                  <input
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    placeholder="例如 Apple"
                    required
                    value={form.name}
                  />
                </label>
                <label className="field">
                  <span>市场</span>
                  <select
                    onChange={(event) => setForm({ ...form, market: event.target.value as Market })}
                    value={form.market}
                  >
                    <option value="US">美股</option>
                    <option value="HK">港股</option>
                    <option value="CN">A股</option>
                  </select>
                </label>
                <label className="field">
                  <span>分组</span>
                  <select
                    onChange={(event) => setForm({ ...form, category: event.target.value as WatchlistCategory })}
                    value={form.category}
                  >
                    <option value="CORE">核心</option>
                    <option value="WATCH">观察</option>
                  </select>
                </label>
                <label className="field field-full">
                  <span>跟踪备注（可选）</span>
                  <textarea
                    onChange={(event) => setForm({ ...form, note: event.target.value })}
                    placeholder="记录关注它的原因或等待条件"
                    rows={3}
                    value={form.note}
                  />
                </label>
              </div>
              {error && <div className="inline-error">{error}</div>}
              <div className="modal-actions">
                <button className="btn" onClick={() => setModalOpen(false)} type="button">取消</button>
                <button className="btn btn-primary" disabled={submitting} type="submit">
                  {submitting ? "正在添加…" : "添加到自选股"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
