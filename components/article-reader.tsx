"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

type ArticleDetail = {
  path: string;
  title: string;
  source: string;
  publishedAt: string;
  status: string;
  body: string;
};

type ArticleReaderProps = {
  path: string;
  onClose: () => void;
};

export function ArticleReader({ path, onClose }: ArticleReaderProps) {
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let active = true;

    fetch(`/api/research/article?path=${encodeURIComponent(path)}`, { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json()) as ArticleDetail & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "文章加载失败。");
        return body;
      })
      .then((data) => {
        if (active) {
          setArticle(data);
          setError("");
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setArticle(null);
          setError(requestError instanceof Error ? requestError.message : "文章加载失败。");
        }
      });

    return () => {
      active = false;
    };
  }, [path]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        aria-modal="true"
        className="modal article-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="modal-head">
          <div>
            <h2>{article?.title ?? "正在打开文章"}</h2>
            <p>
              {article?.source || "Vault"}
              {article?.publishedAt ? ` · ${article.publishedAt}` : ""}
              {article?.status ? ` · ${article.status}` : ""}
            </p>
          </div>
          <button aria-label="关闭" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="article-body">
          {error ? <div className="inline-error">{error}</div> : null}
          {!article && !error ? <p className="muted-copy">正在读取 Vault 文章…</p> : null}
          {article ? <pre className="article-fallback">{stripFront(article.body)}</pre> : null}
        </div>
      </div>
    </div>
  );
}

function stripFront(body: string) {
  return body.replace(/^---[\s\S]*?---\s*/, "").trim() || "（空文章）";
}
