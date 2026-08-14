"use client";

import { useState } from "react";
import { ResearchCockpit } from "@/components/research-cockpit";
import { WatchlistManager } from "@/components/watchlist-manager";
import type { WatchlistItem } from "@/lib/watchlist-types";

export default function ResearchPage() {
  const [selected, setSelected] = useState<WatchlistItem | null>(null);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Stock cockpit</p>
          <h1>个股研究</h1>
          <p className="page-subtitle">
            点自选打开 Vault 里的判断：逻辑、证伪、预期跟踪和关联文章。行情只做配角。
          </p>
        </div>
      </header>
      <WatchlistManager
        selectedId={selected?.id ?? null}
        onSelect={(item) => setSelected(item)}
      />
      <ResearchCockpit item={selected} />
    </div>
  );
}
