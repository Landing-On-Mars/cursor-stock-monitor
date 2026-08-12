import { FileText } from "lucide-react";
import Link from "next/link";
import { scanVaultArticles, type VaultArticle } from "@/lib/vault/articles";
import { resolveVaultPath } from "@/lib/vault/path";

function marketBadge(article: VaultArticle) {
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

function noteMeta(article: VaultArticle) {
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
  const vaultRoot = resolveVaultPath();

  if (!vaultRoot) {
    return (
      <article className="card">
        <div className="card-head">
          <div>
            <h2>最近研究笔记</h2>
            <p>来自 Obsidian vault</p>
          </div>
          <Link href="/settings" className="text-link">
            配置 Vault
          </Link>
        </div>
        <div className="watchlist-empty">
          <FileText size={18} />
          <strong>还没有连接到 Vault</strong>
          <span>在设置中指定 investment-vault 路径后，这里会显示 Articles。</span>
        </div>
      </article>
    );
  }

  let articles: VaultArticle[] = [];
  let error = "";

  try {
    articles = scanVaultArticles(vaultRoot).slice(0, limit);
  } catch (scanError) {
    error = scanError instanceof Error ? scanError.message : "文章扫描失败";
  }

  return (
    <article className="card">
      <div className="card-head">
        <div>
          <h2>最近研究笔记</h2>
          <p>
            {error
              ? "Vault 读取失败"
              : `来自 Articles · 最近 ${articles.length} 篇`}
          </p>
        </div>
        <Link href="/research" className="text-link">
          查看研究
        </Link>
      </div>

      {error ? (
        <div className="inline-error">{error}</div>
      ) : articles.length === 0 ? (
        <div className="watchlist-empty">
          <FileText size={18} />
          <strong>Articles 目录是空的</strong>
          <span>在 Vault 中添加研究笔记后会显示在这里。</span>
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
