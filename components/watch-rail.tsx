"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import {
  type Market,
  type WatchlistCategory,
  type WatchlistItem,
} from "@/lib/watchlist-types";

type Props = {
  selected?: { symbol: string; market: string } | null;
  onSelect: (item: { symbol: string; market: string; name: string }) => void;
};

type GroupState = Record<WatchlistCategory, boolean>;

const defaultGroups: GroupState = { CORE: true, WATCH: true };

function readGroups(): GroupState {
  if (typeof window === "undefined") return defaultGroups;
  try {
    const raw = window.localStorage.getItem("northstar-watch-groups");
    if (!raw) return defaultGroups;
    const parsed = JSON.parse(raw) as Partial<GroupState>;
    return {
      CORE: parsed.CORE !== false,
      WATCH: parsed.WATCH !== false,
    };
  } catch {
    return defaultGroups;
  }
}

export function WatchRail({ selected, onSelect }: Props) {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [query, setQuery] = useState("");
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [market, setMarket] = useState<Market>("US");
  const [category, setCategory] = useState<WatchlistCategory>("CORE");
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("northstar-watch-collapsed") === "1";
  });
  const [openGroups, setOpenGroups] = useState<GroupState>(readGroups);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

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
    fetch("/api/watchlist")
      .then((res) => res.json() as Promise<WatchlistItem[] | { error?: string }>)
      .then((json) => {
        if (!active) return;
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
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) =>
      [item.symbol, item.name, item.market].join(" ").toLowerCase().includes(needle),
    );
  }, [items, query]);

  async function add() {
    if (!symbol.trim() || !name.trim()) return;
    const res = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbol: symbol.trim().toUpperCase(),
        name: name.trim(),
        market,
        category,
        note: "",
      }),
    });
    const json = (await res.json().catch(() => null)) as WatchlistItem | { error?: string } | null;
    if (!res.ok) {
      setError(json && "error" in json ? json.error ?? "添加失败。" : "添加失败。");
      return;
    }
    setSymbol("");
    setName("");
    setAdding(false);
    setError("");
    setOpenGroups((prev) => {
      const next = { ...prev, [category]: true };
      window.localStorage.setItem("northstar-watch-groups", JSON.stringify(next));
      return next;
    });
    await load();
  }

  async function remove(id: number) {
    await fetch(`/api/watchlist/${id}`, { method: "DELETE" });
    await load();
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
        {!collapsed ? <h3>股票池</h3> : null}
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
          {items.slice(0, 18).map((item) => (
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

          {(["CORE", "WATCH"] as const).map((group) => {
            const rows = filtered.filter((item) => item.category === group);
            const opened = openGroups[group];
            return (
              <div key={group} className="watch-group">
                <button
                  type="button"
                  className="watch-group-title"
                  onClick={() => toggleGroup(group)}
                >
                  {opened ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <span>{group === "CORE" ? "核心" : "观察"}</span>
                  <i>{rows.length}</i>
                </button>
                {opened ? (
                  rows.length === 0 ? (
                    <p className="watch-empty">{query ? "没有匹配" : "还没有"}</p>
                  ) : (
                    rows.map((item) => (
                      <div
                        key={item.id}
                        className={`watch-rail-row ${selected?.symbol === item.symbol && selected.market === item.market ? "is-active" : ""}`}
                      >
                        <button type="button" className="watch-rail-main" onClick={() => onSelect(item)}>
                          <strong>{item.symbol}</strong>
                          <span>{item.name}</span>
                        </button>
                        <button type="button" className="watch-rail-del" onClick={() => remove(item.id)}>
                          ×
                        </button>
                      </div>
                    ))
                  )
                ) : null}
              </div>
            );
          })}

          <div className="watch-add">
            {adding ? (
              <>
                <input placeholder="代码" value={symbol} onChange={(event) => setSymbol(event.target.value)} />
                <input placeholder="名称" value={name} onChange={(event) => setName(event.target.value)} />
                <div className="watch-add-row">
                  <select value={market} onChange={(event) => setMarket(event.target.value as Market)}>
                    <option value="US">美股</option>
                    <option value="HK">港股</option>
                    <option value="CN">A股</option>
                  </select>
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value as WatchlistCategory)}
                  >
                    <option value="CORE">核心</option>
                    <option value="WATCH">观察</option>
                  </select>
                </div>
                <div className="watch-add-row">
                  <button className="btn btn-primary" type="button" onClick={add}>
                    加入
                  </button>
                  <button className="btn" type="button" onClick={() => setAdding(false)}>
                    取消
                  </button>
                </div>
              </>
            ) : (
              <button className="watch-add-toggle" type="button" onClick={() => setAdding(true)}>
                <Plus size={14} /> 添加
              </button>
            )}
            {error ? <p className="watch-error">{error}</p> : null}
          </div>
        </>
      )}
    </aside>
  );
}
