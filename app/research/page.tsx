"use client";

import { useState } from "react";
import { ArrowRightLeft, Trash2 } from "lucide-react";
import { ResearchCockpit } from "@/components/research-cockpit";
import { WatchRail } from "@/components/watch-rail";
import type { WatchlistCategory, WatchlistItem } from "@/lib/watchlist-types";

export default function ResearchPage() {
  const [selected, setSelected] = useState<WatchlistItem | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [busy, setBusy] = useState(false);

  function refreshRail() {
    setReloadToken((value) => value + 1);
  }

  async function moveSelected(category: WatchlistCategory) {
    if (!selected || busy) return;
    setBusy(true);
    const res = await fetch(`/api/watchlist/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category }),
    });
    setBusy(false);
    if (!res.ok) return;
    setSelected({ ...selected, category });
    refreshRail();
  }

  async function removeSelected() {
    if (!selected || busy) return;
    setBusy(true);
    const res = await fetch(`/api/watchlist/${selected.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok && res.status !== 204) return;
    setSelected(null);
    refreshRail();
  }

  const otherPool = selected?.category === "CORE" ? "WATCH" : "CORE";

  return (
    <div className="research-layout">
      <WatchRail selected={selected} onSelect={setSelected} reloadToken={reloadToken} />
      <div className="research-main">
        <header className="page-header">
          <div>
            <p className="eyebrow">Research</p>
            <h1>个股驾驶舱</h1>
          </div>
          {selected ? (
            <div className="header-actions">
              <button
                className="btn"
                disabled={busy}
                type="button"
                onClick={() => moveSelected(otherPool)}
              >
                <ArrowRightLeft size={14} />
                {otherPool === "WATCH" ? "移到观察" : "移到核心"}
              </button>
              <button className="btn btn-danger" disabled={busy} type="button" onClick={removeSelected}>
                <Trash2 size={14} />
                移出自选
              </button>
            </div>
          ) : null}
        </header>
        {selected ? (
          <ResearchCockpit symbol={selected.symbol} market={selected.market} name={selected.name} />
        ) : (
          <section className="card cockpit-empty">
            <strong>从左边目录点一只股票</strong>
            <span>添加股票在目录底部。移出或换分组用右上角按钮。</span>
          </section>
        )}
      </div>
    </div>
  );
}
