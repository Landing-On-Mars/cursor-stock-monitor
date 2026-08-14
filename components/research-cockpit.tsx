"use client";

import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  ClipboardCopy,
  FileText,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { ArticleReader } from "@/components/article-reader";
import type { WatchlistItem } from "@/lib/watchlist-types";
import type {
  ArticleSummary,
  CatalystRow,
  ExpectationRow,
  PeerStock,
  StockCockpit,
} from "@/lib/vault/types";

type ResearchResponse = {
  found: boolean;
  vault: { ok: boolean; path: string | null };
  stock: StockCockpit | null;
  articles: ArticleSummary[];
  peers: PeerStock[];
  cursorPrompt: string;
  error?: string;
};

const marketText: Record<string, string> = {
  US: "美股",
  HK: "港股",
  CN: "A股",
};

const tierText: Record<string, string> = {
  core: "核心",
  watch: "观察",
  archive: "路过",
};

export function ResearchCockpit({ item }: { item: WatchlistItem | null }) {
  const [data, setData] = useState<ResearchResponse | null>(null);
  const [error, setError] = useState("");
  const [loadedKey, setLoadedKey] = useState("");
  const [copied, setCopied] = useState(false);
  const [articlePath, setArticlePath] = useState<string | null>(null);
  const itemKey = item ? `${item.market}:${item.symbol}:${item.id}` : "";
  const loading = Boolean(item) && loadedKey !== itemKey;

  useEffect(() => {
    if (!item) return;

    const key = `${item.market}:${item.symbol}:${item.id}`;
    let active = true;

    fetch(
      `/api/research?symbol=${encodeURIComponent(item.symbol)}&market=${encodeURIComponent(item.market)}`,
      { cache: "no-store" },
    )
      .then(async (response) => {
        const body = (await response.json()) as ResearchResponse;
        if (!response.ok) throw new Error(body.error ?? "研究页加载失败。");
        return body;
      })
      .then((payload) => {
        if (!active) return;
        setData(payload);
        setError("");
        setLoadedKey(key);
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        setError(requestError instanceof Error ? requestError.message : "研究页加载失败。");
        setLoadedKey(key);
      });

    return () => {
      active = false;
    };
  }, [item]);

  if (!item) {
    return (
      <section className="card cockpit-empty">
        <strong>点一只自选股</strong>
        <span>驾驶舱会打开 Vault 里对应的个股研究页。</span>
      </section>
    );
  }

  if (loading) {
    return <section className="card cockpit-empty">正在读取 {item.name} 的研究页…</section>;
  }

  if (error) {
    return <section className="card cockpit-empty">{error}</section>;
  }

  if (!data?.found || !data.stock) {
    return (
      <section className="card cockpit-empty">
        <strong>Vault 里还没有 {item.symbol} 的研究页</strong>
        <span>
          {data?.vault.ok
            ? `按模板建一份 Stocks/${item.market}/${item.symbol} 的 Markdown，再回到这里打开。`
            : "没有找到 investment-vault。可在设置里确认 VAULT_PATH，或把 Vault 放在与本项目同级的 investment-vault 目录。"}
        </span>
      </section>
    );
  }

  const stock = data.stock;
  const prompt = data.cursorPrompt;
  const freshness = freshnessChips(stock);

  async function copyPrompt() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section className="cockpit">
      <article className="card cockpit-hero">
        <div className="ticker-head">
          <div className="ticker-title">
            <span className="ticker-badge">{stock.market.slice(0, 2)}</span>
            <div>
              <h2>{stock.name}</h2>
              <p>
                {stock.symbol} · {marketText[stock.market] ?? stock.market}
                {stock.exchange ? ` · ${stock.exchange}` : ""}
                {stock.tier ? ` · ${tierText[stock.tier] ?? stock.tier}` : ""}
              </p>
            </div>
          </div>
          <div className="freshness-stack">
            {freshness.map((chip) => (
              <span className={`status ${chip.tone}`} key={chip.label}>{chip.label}</span>
            ))}
          </div>
        </div>
        <p className="thesis-lead">{stock.summary || item.note || "还没有一句话投资逻辑。"}</p>
        <div className="tag-row">
          {stock.tags.map((tag) => (
            <span className="tag" key={tag}>{tag}</span>
          ))}
          <span className="obsidian-label"><FileText size={12} /> {stock.path}</span>
        </div>
      </article>

      <div className="cockpit-grid">
        <div className="stack">
          <article className="card">
            <div className="card-head">
              <div>
                <h2>现在该看什么</h2>
                <p>买卖条件来自个股页；没有就先用跟踪备注</p>
              </div>
            </div>
            <div className="cockpit-pad">
              {item.note && <p className="muted-copy">自选备注：{item.note}</p>}
              <ConditionList title="买入或加仓" items={stock.buyConditions} empty="还没写买入/加仓条件。" />
              <ConditionList title="减仓或退出" items={stock.sellConditions} empty="还没写减仓/退出条件。" />
            </div>
          </article>

          <article className="card">
            <div className="card-head">
              <div>
                <h2>预期跟踪</h2>
                <p>季报季对着打勾，比再看一张 K 线有用</p>
              </div>
              <span className="chip">{stock.expectations.length} 条</span>
            </div>
            {stock.expectations.length === 0 ? (
              <p className="cockpit-empty-inline">还没有可验证预期。在 Vault 个股页补 2–4 条，带量化目标和验证时点。</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>预期</th>
                      <th>时点</th>
                      <th>状态</th>
                      <th>结果</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stock.expectations.map((row) => (
                      <tr key={row.text}>
                        <td>{row.text}</td>
                        <td>{row.deadline || "—"}</td>
                        <td><StatusPill row={row} /></td>
                        <td>{row.result || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          <article className="card markdown-preview">
            <div className="card-head" style={{ padding: "15px 0", border: 0 }}>
              <div>
                <h2>投资逻辑</h2>
                <p>关键跟踪指标来自个股页</p>
              </div>
            </div>
            {stock.metrics.length > 0 && (
              <ul className="metric-list">
                {stock.metrics.map((metric) => (
                  <li key={metric}>{metric}</li>
                ))}
              </ul>
            )}
            <pre className="thesis-body">{plainThesis(stock.thesis)}</pre>
          </article>

          <article className="card">
            <div className="card-head">
              <div>
                <h2>时间线</h2>
                <p>最近事件，来自个股页 Timeline</p>
              </div>
            </div>
            {stock.timeline.length === 0 ? (
              <p className="cockpit-empty-inline">还没有时间线。</p>
            ) : (
              stock.timeline.map((event) => (
                <div className="note-row" key={`${event.date}-${event.event}`}>
                  <span className={`status ${typeTone(event.type)}`}>{typeLabel(event.type)}</span>
                  <div className="row-main">
                    <strong>{event.event}</strong>
                    <small>{event.date || "日期未填"}</small>
                  </div>
                </div>
              ))
            )}
          </article>
        </div>

        <div className="stack">
          <article className="card cursor-prompt-card">
            <div className="card-head">
              <div>
                <h2><Sparkles size={14} /> 在 Cursor 里问</h2>
                <p>复制到 Agent，不要在网页里另接模型</p>
              </div>
            </div>
            <pre className="cursor-prompt">{prompt}</pre>
            <div className="cockpit-pad">
              <button className="btn" onClick={() => void copyPrompt()}>
                <ClipboardCopy size={14} />
                {copied ? "已复制" : "复制提示词"}
              </button>
            </div>
          </article>

          <article className="card">
            <div className="card-head">
              <div>
                <h2>证伪与风险</h2>
                <p>哪条已经被碰到了</p>
              </div>
            </div>
            {stock.risks.length === 0 ? (
              <p className="cockpit-empty-inline">还没有单独列出风险。可写在「证伪条件与主要风险」。</p>
            ) : (
              stock.risks.map((risk) => (
                <div className="alert-row" key={risk}>
                  <span className="alert-symbol"><AlertTriangle size={14} /></span>
                  <div className="row-main"><strong>{risk}</strong></div>
                </div>
              ))
            )}
          </article>

          <article className="card">
            <div className="card-head">
              <div>
                <h2>催化剂</h2>
                <p>只看关键进展</p>
              </div>
            </div>
            {stock.catalysts.length === 0 ? (
              <p className="cockpit-empty-inline">还没有催化剂记录。</p>
            ) : (
              stock.catalysts.map((row) => (
                <div className="note-row" key={row.text}>
                  <StatusIcon kind={row.statusKind} />
                  <div className="row-main">
                    <strong>{row.text}</strong>
                    <small>{row.detail || row.status || "进展未填"}</small>
                  </div>
                </div>
              ))
            )}
          </article>

          <article className="card">
            <div className="card-head">
              <div>
                <h2>关联文章</h2>
                <p>{data.articles.length} 篇 · 按 symbols 匹配</p>
              </div>
            </div>
            {data.articles.length === 0 ? (
              <p className="cockpit-empty-inline">没有挂上这只股票的文章。</p>
            ) : (
              data.articles.map((article) => (
                <button
                  className="note-row article-hit"
                  key={article.path}
                  onClick={() => setArticlePath(article.path)}
                  type="button"
                >
                  <span className="market-icon"><FileText size={13} /></span>
                  <div className="row-main">
                    <strong>{article.title}</strong>
                    <small>
                      {[article.source, article.publishedAt].filter(Boolean).join(" · ") || article.path}
                    </small>
                  </div>
                </button>
              ))
            )}
          </article>

          {data.peers.length > 0 && (
            <article className="card">
              <div className="card-head">
                <div>
                  <h2>同行</h2>
                  <p>{stock.industries[0]}</p>
                </div>
              </div>
              {data.peers.map((peer) => (
                <div className="watch-row" key={peer.symbol}>
                  <span className={`market-icon market-${peer.market.toLowerCase()}`}>{peer.market}</span>
                  <div className="row-main">
                    <strong>{peer.name}</strong>
                    <small>{peer.symbol} · {tierText[peer.tier] ?? peer.tier}</small>
                  </div>
                </div>
              ))}
            </article>
          )}
        </div>
      </div>

      {articlePath && (
        <ArticleReader key={articlePath} path={articlePath} onClose={() => setArticlePath(null)} />
      )}
    </section>
  );
}

function ConditionList({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <div className="condition-block">
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className="muted-copy">{empty}</p>
      ) : (
        <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
      )}
    </div>
  );
}

function StatusPill({ row }: { row: ExpectationRow }) {
  const label =
    row.status ||
    ({ met: "达标", drift: "偏差", miss: "落空", pending: "待验证", unknown: "未标" }[row.statusKind]);
  return <span className={`status ${statusTone(row.statusKind)}`}>{label}</span>;
}

function StatusIcon({ kind }: { kind: CatalystRow["statusKind"] }) {
  if (kind === "met") return <CheckCircle2 size={16} color="#235c45" />;
  if (kind === "miss") return <AlertTriangle size={16} color="#c64c4c" />;
  return <CircleDashed size={16} color="#9b712e" />;
}

function freshnessChips(stock: StockCockpit) {
  const chips: { label: string; tone: string }[] = [];
  if (stock.updatedAt) chips.push({ label: `笔记 ${stock.updatedAt}`, tone: "status-green" });
  else chips.push({ label: "未填更新日", tone: "status-amber" });

  if (stock.nextEarnings) chips.push({ label: `下次财报 ${stock.nextEarnings}`, tone: "status-green" });
  else chips.push({ label: "财报日未填", tone: "status-amber" });

  const pending = stock.expectations.filter((row) => row.statusKind === "pending").length;
  const miss = stock.expectations.filter((row) => row.statusKind === "miss").length;
  if (miss) chips.push({ label: `${miss} 条预期落空`, tone: "status-red" });
  else if (pending) chips.push({ label: `${pending} 条待验证`, tone: "status-amber" });
  else if (stock.expectations.length) chips.push({ label: "预期已核对", tone: "status-green" });

  return chips;
}

function statusTone(kind: ExpectationRow["statusKind"]) {
  if (kind === "met") return "status-green";
  if (kind === "miss") return "status-red";
  if (kind === "drift" || kind === "pending") return "status-amber";
  return "status-amber";
}

function typeTone(type: string) {
  if (type === "earnings") return "status-green";
  if (type === "news") return "status-amber";
  return "";
}

function typeLabel(type: string) {
  if (type === "earnings") return "财报";
  if (type === "news") return "新闻";
  if (type === "filing") return "公告";
  return "笔记";
}

function plainThesis(thesis: string) {
  return thesis
    .replace(/\*\*Key metrics[\s\S]*?(?=\n\*\*|$)/i, "")
    .replace(/\*\*风险：[\s\S]*?(?=\n\*\*|$)/, "")
    .replace(/^_+/gm, "")
    .replace(/_+$/gm, "")
    .trim();
}
