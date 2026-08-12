"use client";

import {
  ExternalLink,
  FileText,
  LoaderCircle,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  ArticleReader,
  type ArticleSummary,
} from "@/components/article-reader";
import { MarketChart } from "@/components/market-chart";
import { WatchlistManager } from "@/components/watchlist-manager";
import type { WatchlistItem } from "@/lib/watchlist-types";

type VaultArticle = ArticleSummary;

const marketLabel = {
  US: "美股",
  HK: "港股",
  CN: "A股",
} as const;

async function readError(response: Response) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? "请求失败";
}

type ResearchWorkspaceProps = {
  initialSymbol?: string | null;
};

export function ResearchWorkspace({
  initialSymbol = null,
}: ResearchWorkspaceProps) {
  const [selected, setSelected] = useState<WatchlistItem | null>(null);
  const [articleBundle, setArticleBundle] = useState<{
    symbol: string;
    articles: VaultArticle[];
    error: string;
  } | null>(null);
  const [filter, setFilter] = useState("");
  const [preferSymbol] = useState(initialSymbol);
  const [openedArticle, setOpenedArticle] = useState<VaultArticle | null>(null);

  useEffect(() => {
    if (!selected) return;

    const symbol = selected.symbol;
    let active = true;

    void (async () => {
      try {
        const response = await fetch(
          `/api/vault/articles?symbol=${encodeURIComponent(symbol)}`,
          { cache: "no-store" },
        );
        if (!response.ok) throw new Error(await readError(response));
        const data = (await response.json()) as VaultArticle[];
        if (!active) return;
        setArticleBundle({ symbol, articles: data, error: "" });
      } catch (error: unknown) {
        if (!active) return;
        setArticleBundle({
          symbol,
          articles: [],
          error: error instanceof Error ? error.message : "文章加载失败",
        });
      }
    })();

    return () => {
      active = false;
    };
  }, [selected]);

  const articlesLoading =
    Boolean(selected) && articleBundle?.symbol !== selected?.symbol;
  const matchedBundle =
    selected && articleBundle?.symbol === selected.symbol ? articleBundle : null;
  const articlesError = matchedBundle?.error ?? "";

  const visibleArticles = useMemo(() => {
    if (!selected) return [];
    const query = filter.trim().toLowerCase();
    const source =
      articleBundle?.symbol === selected.symbol ? articleBundle.articles : [];
    if (!query) return source;
    return source.filter(
      (article) =>
        article.title.toLowerCase().includes(query) ||
        article.tags.some((tag) => tag.toLowerCase().includes(query)) ||
        article.source.toLowerCase().includes(query),
    );
  }, [articleBundle, filter, selected]);

  function pickInitialItem(items: WatchlistItem[]) {
    if (items.length === 0) return null;
    if (preferSymbol) {
      const matched = items.find(
        (item) => item.symbol.toUpperCase() === preferSymbol,
      );
      if (matched) return matched;
    }
    return items[0];
  }

  return (
    <>
      <WatchlistManager
        onSelect={setSelected}
        selectedId={selected?.id ?? null}
        onItemsChange={(items) => {
          if (!selected) {
            const next = pickInitialItem(items);
            if (next) setSelected(next);
            return;
          }
          if (!items.some((item) => item.id === selected.id)) {
            setSelected(pickInitialItem(items));
          }
        }}
      />

      {!selected ? (
        <section className="card empty-settings" style={{ marginTop: 14 }}>
          <span className="icon-box" style={{ height: 42, width: 42 }}>
            <FileText size={20} />
          </span>
          <h2>选择一只股票查看研究摘要</h2>
          <p>导入 Vault 后，点击上方列表中的任意标的，即可查看 thesis 与关联文章。</p>
        </section>
      ) : (
        <>
          <div className="toolbar">
            <label className="search-field">
              <Search size={15} />
              <input
                onChange={(event) => setFilter(event.target.value)}
                placeholder="筛选关联文章标题或标签…"
                value={filter}
              />
            </label>
            <button className="btn">
              <SlidersHorizontal size={14} />
              {marketLabel[selected.market]}
            </button>
          </div>

          <section className="content-grid">
            <div className="stack">
              <article className="card research-hero">
                <div className="ticker-head">
                  <div className="ticker-title">
                    <span className="ticker-badge">{selected.market}</span>
                    <div>
                      <h2>{selected.name}</h2>
                      <p>
                        {selected.exchange || selected.market} · {selected.symbol} ·{" "}
                        {marketLabel[selected.market]}
                        {selected.currency ? ` · ${selected.currency}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="row-value" style={{ fontSize: 13, textAlign: "right" }}>
                    <span className={`watch-category watch-category-${selected.category.toLowerCase()}`}>
                      {selected.category === "CORE" ? "核心" : "观察"}
                    </span>
                    <small style={{ display: "block", marginTop: 8 }}>
                      关联文章 {selected.articleCount} 篇
                    </small>
                  </div>
                </div>

                <div className="metric-row">
                  {(selected.industries.length ? selected.industries : ["未标注行业"])
                    .slice(0, 4)
                    .map((industry) => (
                      <div className="metric" key={industry}>
                        <small>行业</small>
                        <strong>{industry}</strong>
                      </div>
                    ))}
                </div>

                <div
                  className="card-head"
                  style={{ padding: "12px 0", borderTop: "1px solid var(--line)" }}
                >
                  <div>
                    <h2>日线走势</h2>
                    <p>模拟行情 · 接入数据源后更新</p>
                  </div>
                  <div className="chart-tabs">
                    <button className="active">日线</button>
                    <button>周线</button>
                    <button>月线</button>
                  </div>
                </div>
                <MarketChart />
              </article>

              <article className="card markdown-preview">
                <div className="obsidian-label">
                  <FileText size={13} /> {selected.notePath || "尚未关联 Vault 笔记"}
                </div>
                <h3>投资逻辑摘要</h3>
                <p>{selected.thesis || selected.note || "Vault 笔记中暂无 Investment thesis。"}</p>
                {selected.tags.length > 0 && (
                  <ul>
                    {selected.tags.slice(0, 6).map((tag) => (
                      <li key={tag}>{tag}</li>
                    ))}
                  </ul>
                )}
              </article>
            </div>

            <aside className="card">
              <div className="card-head">
                <div>
                  <h2>关联文章</h2>
                  <p>
                    {articlesLoading
                      ? "加载中…"
                      : `共 ${visibleArticles.length} 篇`}
                  </p>
                </div>
                <span className="obsidian-label">OBSIDIAN</span>
              </div>

              {articlesError && <div className="inline-error">{articlesError}</div>}

              {articlesLoading ? (
                <div className="watchlist-empty">
                  <LoaderCircle className="spin" size={18} />
                  <span>正在读取 Articles…</span>
                </div>
              ) : visibleArticles.length === 0 ? (
                <div className="watchlist-empty">
                  <FileText size={18} />
                  <strong>暂无关联文章</strong>
                  <span>该标的在 Articles Frontmatter 的 symbols 中没有命中。</span>
                </div>
              ) : (
                visibleArticles.map((article) => (
                  <button
                    className="note-row note-row-link note-row-button"
                    key={article.path}
                    onClick={() => setOpenedArticle(article)}
                    type="button"
                  >
                    <span className="market-icon">
                      <FileText size={13} />
                    </span>
                    <div className="row-main">
                      <strong>{article.title}</strong>
                      <small>
                        {(article.publishedAt || article.savedAt || "未知日期") +
                          (article.source ? ` · ${article.source}` : "") +
                          (article.tags[0] ? ` · ${article.tags[0]}` : "")}
                      </small>
                    </div>
                    <span title="打开文章">
                      <ExternalLink size={13} color="#929a94" />
                    </span>
                  </button>
                ))
              )}
            </aside>
          </section>
        </>
      )}

      <ArticleReader
        article={openedArticle}
        onClose={() => setOpenedArticle(null)}
      />
    </>
  );
}
