"use client";

import { ExternalLink, FileText, LoaderCircle, X } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";

export type ArticleSummary = {
  title: string;
  path: string;
  source: string;
  publishedAt: string;
  savedAt: string;
  symbols: string[];
  tags: string[];
  status: string;
};

type ArticleDetail = ArticleSummary & {
  content: string;
  author: string;
  obsidianUri?: string;
};

type ContentPart =
  | { type: "text"; value: string }
  | { type: "image"; alt: string; src: string };

function splitArticleContent(content: string): ContentPart[] {
  const pattern = /!\[([^\]]*)\]\((\/api\/vault\/asset\?[^)\s]+)\)/g;
  const parts: ContentPart[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: content.slice(lastIndex, match.index) });
    }
    parts.push({ type: "image", alt: match[1] || "文章配图", src: match[2] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push({ type: "text", value: content.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: "text", value: content || "（空文章）" }];
}

async function readError(response: Response) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? "读取文章失败";
}

type ArticleReaderProps = {
  article: ArticleSummary | null;
  onClose: () => void;
};

export function ArticleReader({ article, onClose }: ArticleReaderProps) {
  const [detail, setDetail] = useState<ArticleDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!article) {
      return;
    }

    const path = article.path;
    let active = true;

    void (async () => {
      setLoading(true);
      setError("");
      setDetail(null);
      try {
        const response = await fetch(
          `/api/vault/articles/content?path=${encodeURIComponent(path)}`,
          { cache: "no-store" },
        );
        if (!response.ok) throw new Error(await readError(response));
        const data = (await response.json()) as ArticleDetail;
        if (!active) return;
        setDetail(data);
      } catch (requestError: unknown) {
        if (!active) return;
        setError(
          requestError instanceof Error ? requestError.message : "读取文章失败",
        );
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [article]);

  const parts = useMemo(
    () => splitArticleContent(detail?.content ?? ""),
    [detail?.content],
  );

  if (!article) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        aria-labelledby="article-reader-title"
        aria-modal="true"
        className="modal article-reader-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="modal-head">
          <div>
            <p className="obsidian-label" style={{ marginBottom: 6 }}>
              <FileText size={13} /> {article.path}
            </p>
            <h2 id="article-reader-title">{detail?.title || article.title}</h2>
            <p>
              {(detail?.publishedAt || article.publishedAt || article.savedAt || "未知日期") +
                (detail?.source || article.source
                  ? ` · ${detail?.source || article.source}`
                  : "")}
            </p>
          </div>
          <div className="article-reader-actions">
            {detail?.obsidianUri && (
              <a className="btn" href={detail.obsidianUri}>
                <ExternalLink size={14} />
                Obsidian
              </a>
            )}
            <button aria-label="关闭" onClick={onClose} type="button">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="article-reader-body">
          {loading ? (
            <div className="watchlist-empty">
              <LoaderCircle className="spin" size={18} />
              <span>正在读取文章…</span>
            </div>
          ) : error ? (
            <div className="inline-error">{error}</div>
          ) : (
            <div className="article-markdown">
              {parts.map((part, index) =>
                part.type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={part.alt}
                    className="article-image"
                    key={`img-${index}-${part.src}`}
                    loading="lazy"
                    src={part.src}
                  />
                ) : (
                  <Fragment key={`text-${index}`}>
                    {part.value ? <span className="article-text">{part.value}</span> : null}
                  </Fragment>
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
