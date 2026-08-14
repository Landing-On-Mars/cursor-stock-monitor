"use client";

import { useState } from "react";
import { ResearchCockpit } from "@/components/research-cockpit";
import { WatchRail } from "@/components/watch-rail";

export default function ResearchPage() {
  const [selected, setSelected] = useState<{
    symbol: string;
    market: string;
    name: string;
  } | null>(null);

  return (
    <div className="research-layout">
      <WatchRail selected={selected} onSelect={setSelected} />
      <div className="research-main">
        <header className="page-header">
          <div>
            <p className="eyebrow">Research</p>
            <h1>个股驾驶舱</h1>
            <p className="page-subtitle">左边是可收起的股票池；K 线、估值和关联文章都在这页。</p>
          </div>
        </header>
        {selected ? (
          <ResearchCockpit symbol={selected.symbol} market={selected.market} name={selected.name} />
        ) : (
          <section className="card cockpit-empty">
            <strong>从左边目录点一只股票</strong>
            <span>添加股票也在目录里。菜单栏和股票池都可以收成图标。</span>
          </section>
        )}
      </div>
    </div>
  );
}
