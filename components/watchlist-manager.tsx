"use client";

import {
  Check,
  Download,
  FileText,
  LoaderCircle,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  type Market,
  type WatchlistCategory,
  type WatchlistItem,
} from "@/lib/watchlist-types";

const categoryText: Record<WatchlistCategory, string> = {
  CORE: "核心",
  WATCH: "观察",
  LOW_FREQUENCY: "低频",
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

type StockSearchResult = {
  symbol: string;
  yahooSymbol: string;
  name: string;
  market: Market;
};

type MarketFilter = "ALL" | Market;

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

type WatchlistManagerProps = {
  selectedId?: number | null;
  onSelect?: (item: WatchlistItem) => void;
  onItemsChange?: (items: WatchlistItem[]) => void;
};

export function WatchlistManager({
  selectedId = null,
  onSelect,
  onItemsChange,
}: WatchlistManagerProps) {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [category, setCategory] = useState<WatchlistCategory>("CORE");
  const [market, setMarket] = useState<MarketFilter>("ALL");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [stockQuery, setStockQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequest = useRef(0);

  function applyItems(next: WatchlistItem[]) {
    setItems(next);
    onItemsChange?.(next);
  }

  useEffect(() => {
    let active = true;

    fetch("/api/watchlist", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(await readError(response));
        return response.json() as Promise<WatchlistItem[]>;
      })
      .then((data) => {
        if (!active) return;
        applyItems(data);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    [],
  );

  const counts = useMemo(
    () => ({
      ALL: items.length,
      CORE: items.filter((item) => item.category === "CORE").length,
      WATCH: items.filter((item) => item.category === "WATCH").length,
      LOW_FREQUENCY: items.filter((item) => item.category === "LOW_FREQUENCY").length,
      HK: items.filter((item) => item.market === "HK").length,
      CN: items.filter((item) => item.market === "CN").length,
      US: items.filter((item) => item.market === "US").length,
    }),
    [items],
  );

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      if (item.category !== category) return false;
      if (market !== "ALL" && item.market !== market) return false;
      if (!normalizedQuery) return true;
      return (
        item.symbol.toLowerCase().includes(normalizedQuery) ||
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.industries.some((entry) => entry.toLowerCase().includes(normalizedQuery))
      );
    });
  }, [category, items, market, query]);

  function openCreateForm() {
    setForm({
      ...emptyForm,
      category,
    });
    setStockQuery("");
    setSearchResults([]);
    setSearchError("");
    setSearching(false);
    setError("");
    setModalOpen(true);
  }

  function searchStocks(value: string) {
    setStockQuery(value);
    setForm((current) => ({ ...current, symbol: "", name: "" }));
    setSearchResults([]);
    setSearchError("");

    if (searchTimer.current) clearTimeout(searchTimer.current);
    const queryValue = value.trim();

    if (!queryValue) {
      setSearching(false);
      return;
    }

    setSearching(true);
    const requestId = ++searchRequest.current;

    searchTimer.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/stocks/search?q=${encodeURIComponent(queryValue)}`,
          { cache: "no-store" },
        );
        if (!response.ok) throw new Error(await readError(response));

        const results = (await response.json()) as StockSearchResult[];
        if (requestId !== searchRequest.current) return;
        setSearchResults(results);
        if (results.length === 0) setSearchError("没有找到可添加的股票。");
      } catch (requestError) {
        if (requestId !== searchRequest.current) return;
        setSearchError(
          requestError instanceof Error ? requestError.message : "股票搜索失败。",
        );
      } finally {
        if (requestId === searchRequest.current) setSearching(false);
      }
    }, 280);
  }

  function selectStock(result: StockSearchResult) {
    setForm((current) => ({
      ...current,
      symbol: result.symbol,
      name: result.name,
      market: result.market,
    }));
    setStockQuery(`${result.symbol} · ${result.name}`);
    setSearchResults([]);
    setSearchError("");
  }

  async function importFromVault() {
    setImporting(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/vault/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replace: false }),
      });
      if (!response.ok) throw new Error(await readError(response));

      const payload = (await response.json()) as {
        imported: number;
        core: number;
        watch: number;
        items: WatchlistItem[];
      };
      applyItems(payload.items);
      setNotice(
        `已从 Vault 导入 ${payload.imported} 只（核心 ${payload.core} · 观察 ${payload.watch}）`,
      );
      if (payload.items[0]) onSelect?.(payload.items[0]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Vault 导入失败。");
    } finally {
      setImporting(false);
    }
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
      applyItems([...items, item]);
      setCategory(item.category);
      setModalOpen(false);
      onSelect?.(item);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "添加失败。");
    } finally {
      setSubmitting(false);
    }
  }

  async function changeCategory(
    item: WatchlistItem,
    nextCategory: WatchlistCategory,
  ) {
    if (nextCategory === item.category) return;

    setBusyId(item.id);
    setError("");

    try {
      const response = await fetch(`/api/watchlist/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: nextCategory }),
      });
      if (!response.ok) throw new Error(await readError(response));

      applyItems(
        items.map((entry) =>
          entry.id === item.id ? { ...entry, category: nextCategory } : entry,
        ),
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "分组更新失败。");
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
      applyItems(items.filter((entry) => entry.id !== item.id));
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
            <h2>Vault 自选股</h2>
            <p>紧凑列表 · 核心 / 观察 / 低频 · 文章关联计数</p>
          </div>
          <div className="watchlist-head-actions">
            <button className="btn" disabled={importing} onClick={() => void importFromVault()}>
              {importing ? <LoaderCircle className="spin" size={14} /> : <Download size={14} />}
              {importing ? "导入中…" : "从 Vault 导入"}
            </button>
            <button className="btn btn-primary" onClick={openCreateForm}>
              <Plus size={14} />添加
            </button>
          </div>
        </div>

        <div className="watchlist-controls compact-controls">
          <div className="segment-control">
            {(["CORE", "WATCH", "LOW_FREQUENCY"] as const).map((value) => (
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
          <div className="segment-control">
            {(["ALL", "HK", "CN", "US"] as const).map((value) => (
              <button
                className={market === value ? "active" : ""}
                key={value}
                onClick={() => setMarket(value)}
              >
                {value === "ALL" ? "市场" : marketText[value]}
                <span>{counts[value]}</span>
              </button>
            ))}
          </div>
          <label className="watchlist-search">
            <Search size={14} />
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="代码 / 名称 / 行业"
              value={query}
            />
          </label>
        </div>

        {notice && !modalOpen && <div className="inline-notice">{notice}</div>}
        {error && !modalOpen && <div className="inline-error">{error}</div>}

        <div className="dense-watchlist-head" aria-hidden>
          <span>市场</span>
          <span>代码</span>
          <span>名称</span>
          <span>分组</span>
          <span>文章</span>
          <span />
        </div>

        <div className="dense-watchlist">
          {loading ? (
            <div className="watchlist-empty">正在加载自选股…</div>
          ) : visibleItems.length === 0 ? (
            <div className="watchlist-empty">
              <Star size={20} />
              <strong>还没有可显示的股票</strong>
              <span>先从 Vault 导入 75 只标的，或手动添加一只。</span>
            </div>
          ) : (
            visibleItems.map((item) => (
              <div
                className={`dense-watch-row ${selectedId === item.id ? "selected" : ""}`}
                key={item.id}
                onClick={() => onSelect?.(item)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect?.(item);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <span className={`market-icon market-${item.market.toLowerCase()}`}>
                  {item.market}
                </span>
                <strong className="dense-symbol">{item.symbol}</strong>
                <span className="dense-name">
                  <strong>{item.name}</strong>
                  <small>
                    {(item.industries[0] || item.exchange || marketText[item.market]) +
                      (item.thesis ? ` · ${item.thesis.slice(0, 36)}` : "")}
                  </small>
                </span>
                <select
                  aria-label={`${item.name} 的分组`}
                  className={`watch-category category-select watch-category-${item.category.toLowerCase()}`}
                  disabled={busyId === item.id}
                  onChange={(event) =>
                    void changeCategory(
                      item,
                      event.target.value as WatchlistCategory,
                    )
                  }
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                  value={item.category}
                >
                  {(["CORE", "WATCH", "LOW_FREQUENCY"] as const).map((value) => (
                    <option key={value} value={value}>
                      {categoryText[value]}
                    </option>
                  ))}
                </select>
                <span className="dense-articles">
                  <FileText size={12} />
                  {item.articleCount}
                </span>
                <span
                  className="row-actions"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <button
                    className="danger-action"
                    disabled={busyId === item.id}
                    onClick={() => void deleteItem(item)}
                    title="删除"
                    type="button"
                  >
                    <Trash2 size={13} />
                  </button>
                </span>
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
              <div>
                <h2 id="add-stock-title">添加自选股</h2>
                <p>搜索结果使用 Yahoo 完整代码，便于与 Vault 文章对齐</p>
              </div>
              <button onClick={() => setModalOpen(false)} aria-label="关闭">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={createItem}>
              <div className="form-grid">
                <div className="field field-full stock-picker">
                  <span>搜索股票代码或公司名称</span>
                  <div className={`stock-search-input ${form.symbol ? "selected" : ""}`}>
                    {searching ? (
                      <LoaderCircle className="spin" size={15} />
                    ) : form.symbol ? (
                      <Check size={15} />
                    ) : (
                      <Search size={15} />
                    )}
                    <input
                      autoComplete="off"
                      autoFocus
                      onChange={(event) => searchStocks(event.target.value)}
                      placeholder="例如 300308、AAPL、Tencent"
                      required
                      value={stockQuery}
                    />
                  </div>
                  {searchResults.length > 0 && (
                    <div className="stock-search-results">
                      {searchResults.map((result) => (
                        <button
                          key={`${result.market}-${result.symbol}`}
                          onClick={() => selectStock(result)}
                          type="button"
                        >
                          <span className={`market-icon market-${result.market.toLowerCase()}`}>
                            {result.market}
                          </span>
                          <span className="stock-result-main">
                            <strong>{result.name}</strong>
                            <small>{result.yahooSymbol}</small>
                          </span>
                          <span className="stock-result-market">{marketText[result.market]}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchError && <small className="field-error">{searchError}</small>}
                  {form.symbol && (
                    <div className="selected-stock">
                      <Check size={13} />
                      已选择 {form.name}（{form.symbol}）· {marketText[form.market]}
                    </div>
                  )}
                </div>
                <label className="field">
                  <span>分组</span>
                  <select
                    onChange={(event) =>
                      setForm({ ...form, category: event.target.value as WatchlistCategory })
                    }
                    value={form.category}
                  >
                    <option value="CORE">核心</option>
                    <option value="WATCH">观察</option>
                    <option value="LOW_FREQUENCY">低频</option>
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
                <button className="btn" onClick={() => setModalOpen(false)} type="button">
                  取消
                </button>
                <button
                  className="btn btn-primary"
                  disabled={submitting || !form.symbol}
                  type="submit"
                >
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
