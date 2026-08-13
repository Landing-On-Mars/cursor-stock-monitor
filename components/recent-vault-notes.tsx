import { FileText } from "lucide-react";
import Link from "next/link";
import { listStoredArticles, type StoredArticle } from "@/lib/store-articles";

function marketBadge(article: StoredArticle) {
  const symbol = article.symbols[0]?.toUpperCase() ?? "";
  if (!symbol) return "研";
  if (symbol.endsWith(".HK")) return "HK";
  if (symbol.endsWith(".SS") || symbol.endsWith(".SZ")) return "CN";
  if (/^[A-Z]+$/.test(symbol)) return "US";
  return symbol.slice(0, 2);
}

function marketClass(badge: string) {
  if (badge === "HK") return "market-hk";
  if (badge === "CN") return "market-cn";
  if (badge === "US") return "market-us";
  return "";
}

function formatNoteDate(value: string) {
  if (!value) return "未标注日期";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(parsed));
}

function noteMeta(article: StoredArticle) {
  const parts: string[] = [];
  if (article.symbols.length > 0) {
    parts.push(article.symbols.slice(0, 2).join(" · "));
  }
  if (article.source) parts.push(article.source);
  else if (article.tags[0]) parts.push(article.tags[0]);
  return parts.join(" · ") || article.path;
}

type RecentVaultNotesProps = {
  limit?: number;
};

export async function RecentVaultNotes({ limit = 6 }: RecentVaultNotesProps) {
  let articles: StoredArticle[] = [];
  let error = "";

  try {
    articles = listStoredArticles().slice(0, limit);
  } catch (scanError) {
    error = scanError instanceof Error ? scanError.message : "文章读取失败";
  }

  return (
    <article className="card">
      <div className="card-head">
        <div>
          <h2>最近研究笔记</h2>
          <p>
            {error
              ? "读取失败"
              : articles.length > 0
                ? `来自同步库 · 最近 ${articles.length} 篇`
                : "还没有导入文章"}
          </p>
        </div>
        <Link href={articles.length > 0 ? "/research" : "/settings"} className="text-link">
          {articles.length > 0 ? "查看研究" : "去导入"}
        </Link>
      </div>

      {error ? (
        <div className="inline-error">{error}</div>
      ) : articles.length === 0 ? (
        <div className="watchlist-empty">
          <FileText size={18} />
          <strong>同步库里还没有文章</strong>
          <span>在设置中从 Journal 导入一次，之后只需 Google Drive 同步。</span>
        </div>
      ) : (
        <div className="notes-list">
          {articles.map((article) => {
            const badge = marketBadge(article);
            return (
              <Link
                className="note-row note-row-link"
                href={
                  article.symbols[0]
                    ? `/research?symbol=${encodeURIComponent(article.symbols[0])}`
                    : "/research"
                }
                key={article.path}
              >
                <span className={`market-icon ${marketClass(badge)}`}>{badge}</span>
                <div className="row-main">
                  <strong>{article.title}</strong>
                  <small>{noteMeta(article)}</small>
                </div>
                <span className="tag">
                  {article.tags.find((tag) => tag !== "article") ||
                    article.status ||
                    "笔记"}
                </span>
                <time>{formatNoteDate(article.publishedAt || article.savedAt)}</time>
              </Link>
            );
          })}
        </div>
      )}
    </article>
  );
}
