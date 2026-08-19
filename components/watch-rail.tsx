"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  ChevronRight,
  LoaderCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
} from "lucide-react";
import { draftFromQuery, type StockSearchResult } from "@/lib/marketdata/stock-search";
import { exchangeLabel } from "@/lib/vault/symbols";
import {
  CATEGORY_LABEL,
  WATCHLIST_CATEGORIES,
  type WatchlistCategory,
  type WatchlistItem,
} from "@/lib/watchlist-types";

type Props = {
  selected?: { symbol: string; market: string } | null;
  onSelect: (item: WatchlistItem) => void;
  reloadToken?: number;
};

type GroupState = Record<WatchlistCategory, boolean>;

const defaultGroups: GroupState = { CORE: true, WATCH: true, OTHER: true };

function readGroups(): GroupState {
  if (typeof window === "undefined") return defaultGroups;
  try {
    const raw = window.localStorage.getItem("northstar-watch-groups");
    if (!raw) return defaultGroups;
    const parsed = JSON.parse(raw) as Partial<GroupState>;
    return {
      CORE: parsed.CORE !== false,
      WATCH: parsed.WATCH !== false,
      OTHER: parsed.OTHER !== false,
    };
  } catch {
    return defaultGroups;
  }
}

type VaultStatus = {
  ok: boolean;
  stockCount: number;
};

export function WatchRail({ selected, onSelect, reloadToken = 0 }: Props) {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [vault, setVault] = useState<VaultStatus | null>(null);
  const [query, setQuery] = useState("");
  const [stockQuery, setStockQuery] = useState("");
  const [picked, setPicked] = useState<StockSearchResult | null>(null);
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [category, setCategory] = useState<WatchlistCategory>("CORE");
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("northstar-watch-collapsed") === "1";
  });
  const [openGroups, setOpenGroups] = useState<GroupState>(readGroups);
  const [adding, setAdding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequest = useRef(0);

  function load() {
    return fetch("/api/watchlist")
      .then((res) => res.json() as Promise<WatchlistItem[] | { error?: string }>)
      .then((json) => {
        if (Array.isArray(json)) {
          setItems(json);
          setError("");
          return;
        }
        setError(json.error ?? "读取股票池失败。");
      })
      .catch(() => {
        setError("读取股票池失败。");
      });
  }

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/watchlist", { cache: "no-store" }).then(
        (res) => res.json() as Promise<WatchlistItem[] | { error?: string }>,
      ),
      fetch("/api/vault/status", { cache: "no-store" })
        .then((res) => res.json() as Promise<VaultStatus>)
        .catch(() => null),
    ])
      .then(([json, status]) => {
        if (!active) return;
        if (status) setVault(status);
        if (Array.isArray(json)) {
          setItems(json);
          setError("");
          return;
        }
        setError(json.error ?? "读取股票池失败。");
      })
      .catch(() => {
        if (active) setError("读取股票池失败。");
      });
    return () => {
      active = false;
    };
  }, [reloadToken]);

  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    [],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) =>
      [item.symbol, item.name, item.market].join(" ").toLowerCase().includes(needle),
    );
  }, [items, query]);

  const pending = picked ?? matchingSearch(stockQuery, searchResults) ?? draftFromQuery(stockQuery);

  function resetAddForm() {
    setAdding(false);
    setStockQuery("");
    setPicked(null);
    setSearchResults([]);
    setSearching(false);
    setSubmitting(false);
    if (searchTimer.current) clearTimeout(searchTimer.current);
  }

  function searchStocks(value: string) {
    setStockQuery(value);
    setPicked(null);
    setSearchResults([]);
    setError("");

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
        const body = (await response.json()) as StockSearchResult[] | { error?: string };
        if (requestId !== searchRequest.current) return;
        if (!response.ok || !Array.isArray(body)) {
          setSearchResults([]);
          return;
        }
        setSearchResults(body);
      } catch {
        if (requestId !== searchRequest.current) return;
        setSearchResults([]);
      } finally {
        if (requestId === searchRequest.current) setSearching(false);
      }
    }, 280);
  }

  async function add() {
    const stock = pending;
    if (!stock || submitting) return;
    setSubmitting(true);
    setError("");
    const res = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbol: stock.symbol,
        name: stock.name,
        market: stock.market,
        category,
        note: "",
      }),
    });
    const json = (await res.json().catch(() => null)) as WatchlistItem | { error?: string } | null;
    if (!res.ok) {
      setSubmitting(false);
      setError(json && "error" in json ? json.error ?? "添加失败。" : "添加失败。");
      return;
    }
    const item = json as WatchlistItem;
    setOpenGroups((prev) => {
      const next = { ...prev, [category]: true };
      window.localStorage.setItem("northstar-watch-groups", JSON.stringify(next));
      return next;
    });
    resetAddForm();
    setError("");
    await load();
    onSelect(item);
  }

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    window.localStorage.setItem("northstar-watch-collapsed", next ? "1" : "0");
  }

  function toggleGroup(group: WatchlistCategory) {
    setOpenGroups((prev) => {
      const next = { ...prev, [group]: !prev[group] };
      window.localStorage.setItem("northstar-watch-groups", JSON.stringify(next));
      return next;
    });
  }

  return (
    <aside className={`watch-rail ${collapsed ? "is-collapsed" : ""}`}>
      <div className="watch-rail-head">
        {!collapsed ? (
          <h3>
            股票池
            {items.length > 0 ? <i>{items.length}</i> : null}
          </h3>
        ) : null}
        <button
          className="icon-btn"
          type="button"
          title={collapsed ? "展开股票池" : "收起股票池"}
          onClick={toggleCollapsed}
        >
          {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
      </div>

      {collapsed ? (
        <div className="watch-rail-icons">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`watch-icon ${selected?.symbol === item.symbol && selected.market === item.market ? "is-active" : ""}`}
              title={`${item.symbol} ${item.name}`}
              onClick={() => onSelect(item)}
            >
              {item.symbol.replace(/^0+/, "").slice(0, 2) || item.symbol.slice(0, 2)}
            </button>
          ))}
          <button className="watch-icon add" type="button" title="展开后添加" onClick={toggleCollapsed}>
            <Plus size={14} />
          </button>
        </div>
      ) : (
        <>
          <input
            className="watch-search"
            placeholder="搜索"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          {WATCHLIST_CATEGORIES.map((group) => {
            const rows = filtered.filter((item) => item.category === group);
            if (rows.length === 0) return null;
            const opened = openGroups[group];
            return (
              <div key={group} className="watch-group">
                <button
                  type="button"
                  className="watch-group-title"
                  onClick={() => toggleGroup(group)}
                >
                  {opened ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  <span>{CATEGORY_LABEL[group]}</span>
                  <i>{rows.length}</i>
                </button>
                {opened
                  ? rows.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`watch-rail-row ${selected?.symbol === item.symbol && selected.market === item.market ? "is-active" : ""}`}
                        title={`${item.symbol} ${item.name}`}
                        onClick={() => onSelect(item)}
                      >
                        <strong>{item.symbol}</strong>
                        <span>{item.name}</span>
                      </button>
                    ))
                  : null}
              </div>
            );
          })}

          <div className="watch-add">
            {adding ? (
              <div className="watch-add-form">
                <label className={`watch-add-search ${picked ? "is-picked" : ""}`}>
                  {searching ? <LoaderCircle className="spin" size={13} /> : picked ? <Check size={13} /> : <Search size={13} />}
                  <input
                    autoComplete="off"
                    autoFocus
                    placeholder="代码或名称，如 0883"
                    value={stockQuery}
                    onChange={(event) => searchStocks(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void add();
                      }
                      if (event.key === "Escape") resetAddForm();
                    }}
                  />
                </label>
                {searchResults.length > 0 ? (
                  <div className="watch-add-results">
                    {searchResults.map((result) => (
                      <button
                        key={`${result.market}-${result.symbol}`}
                        type="button"
                        onClick={() => {
                          setPicked(result);
                          setStockQuery(`${result.symbol} ${result.name}`);
                          setSearchResults([]);
                        }}
                      >
                        <strong>{result.symbol}</strong>
                        <span>{result.name}</span>
                        <i>{exchangeLabel(result.symbol, result.market)}</i>
                      </button>
                    ))}
                  </div>
                ) : null}
                {picked ? (
                  <p className="watch-add-picked">
                    {picked.name} · {exchangeLabel(picked.symbol, picked.market)}
                  </p>
                ) : pending && stockQuery.trim() ? (
                  <p className={searchResults.length > 0 ? "watch-add-picked" : "watch-rail-hint"}>
                    {searchResults.length > 0
                      ? `${pending.name} · ${exchangeLabel(pending.symbol, pending.market)}`
                      : `未搜到匹配，将按 ${exchangeLabel(pending.symbol, pending.market)} ${pending.symbol} 加入`}
                  </p>
                ) : null}
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value as WatchlistCategory)}
                >
                  {WATCHLIST_CATEGORIES.map((value) => (
                    <option key={value} value={value}>
                      {CATEGORY_LABEL[value]}
                    </option>
                  ))}
                </select>
                <div className="watch-add-actions">
                  <button
                    className="watch-add-join"
                    disabled={!pending || submitting}
                    type="button"
                    onClick={() => void add()}
                  >
                    {submitting ? "加入中…" : "加入"}
                  </button>
                  <button className="watch-add-cancel" type="button" onClick={resetAddForm}>
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <button className="watch-add-toggle" type="button" onClick={() => setAdding(true)}>
                <Plus size={14} /> 添加
              </button>
            )}
            {error ? <p className="watch-error">{error}</p> : null}
            {vault && !vault.ok ? (
              <p className="watch-rail-hint">
                <Link href="/settings">设置 Vault</Link>
                后会从 Stocks 导入
              </p>
            ) : vault && vault.stockCount > items.length + 3 ? (
              <p className="watch-rail-hint">Vault 有 {vault.stockCount} 只，刷新后再看</p>
            ) : null}
          </div>
        </>
      )}
    </aside>
  );
}

function matchingSearch(query: string, results: StockSearchResult[]) {
  const raw = query.trim().toUpperCase();
  if (!raw || results.length === 0) return null;
  return (
    results.find((item) => item.symbol.toUpperCase() === raw || item.yahooSymbol.toUpperCase() === raw) ??
    results.find(
      (item) =>
        item.symbol.replace(/\.[A-Z]{1,3}$/i, "").toUpperCase() === raw ||
        item.yahooSymbol.replace(/\.[A-Z]{1,3}$/i, "").toUpperCase() === raw,
    ) ??
    results[0]
  );
}
