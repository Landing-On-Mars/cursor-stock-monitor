"use client";

import { LoaderCircle, Pencil, Save, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MarkdownToolbar } from "@/components/markdown-toolbar";
import { splitArticleBody, type ArticleBlock } from "@/lib/vault/article-media";

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
  onSaved?: (article: ArticleDetail) => void;
};

async function readError(response: Response) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? "读取文章失败";
}

export function ArticleReader({ path, onClose, onSaved }: ArticleReaderProps) {
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState("");
  const [sourceDraft, setSourceDraft] = useState("");
  const editorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (editing) {
        setDraft(article?.body ?? "");
        setSourceDraft(article?.source ?? "");
        setEditing(false);
        setError("");
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [article, editing, onClose]);

  useEffect(() => {
    let active = true;

    fetch(`/api/research/article?path=${encodeURIComponent(path)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(await readError(response));
        return (await response.json()) as ArticleDetail;
      })
      .then((data) => {
        if (!active) return;
        setArticle(data);
        setDraft(data.body || "");
        setSourceDraft(data.source || "");
        setEditing(false);
        setError("");
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        setArticle(null);
        setError(requestError instanceof Error ? requestError.message : "文章加载失败。");
      });

    return () => {
      active = false;
    };
  }, [path]);

  async function saveDraft() {
    if (!article) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/research/article", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: article.path,
          content: draft,
          source: sourceDraft,
        }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const data = (await response.json()) as ArticleDetail;
      setArticle(data);
      setDraft(data.body || draft);
      setSourceDraft(data.source || sourceDraft);
      setEditing(false);
      onSaved?.(data);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  const blocks = article && !editing ? splitArticleBody(article.body) : [];

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={() => {
        if (!editing) onClose();
      }}
    >
      <div
        aria-modal="true"
        className="modal article-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="modal-head">
          <div>
            <h2>{article?.title ?? "正在打开文章"}</h2>
            <p className="article-meta">
              {editing ? (
                <>
                  <input
                    aria-label="来源"
                    className="article-source-input"
                    onChange={(event) => setSourceDraft(event.target.value)}
                    placeholder="来源，例如：我的想法"
                    value={sourceDraft}
                  />
                  {article?.publishedAt ? <span> · {article.publishedAt}</span> : null}
                </>
              ) : (
                <>
                  {article?.source || "Vault"}
                  {article?.publishedAt ? ` · ${article.publishedAt}` : ""}
                  {article?.status ? ` · ${article.status}` : ""}
                </>
              )}
            </p>
          </div>
          <div className="article-reader-actions">
            {article && !editing ? (
              <button
                className="btn"
                onClick={() => {
                  setDraft(article.body || "");
                  setSourceDraft(article.source || "");
                  setEditing(true);
                }}
                type="button"
              >
                <Pencil size={14} />
                编辑
              </button>
            ) : null}
            {editing ? (
              <>
                <button
                  className="btn btn-primary"
                  disabled={saving}
                  onClick={() => void saveDraft()}
                  type="button"
                >
                  {saving ? <LoaderCircle className="spin" size={14} /> : <Save size={14} />}
                  {saving ? "保存中…" : "保存"}
                </button>
                <button
                  className="btn"
                  disabled={saving}
                  onClick={() => {
                    setDraft(article?.body || "");
                    setSourceDraft(article?.source || "");
                    setEditing(false);
                    setError("");
                  }}
                  type="button"
                >
                  取消
                </button>
              </>
            ) : null}
            <button aria-label="关闭" type="button" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="article-body">
          {error ? <div className="inline-error">{error}</div> : null}
          {!article && !error ? <p className="muted-copy">正在读取 Vault 文章…</p> : null}
          {article && editing ? (
            <div className="article-editor-wrap">
              <MarkdownToolbar onChange={setDraft} textareaRef={editorRef} value={draft} />
              <textarea
                className="article-editor"
                onChange={(event) => setDraft(event.target.value)}
                ref={editorRef}
                spellCheck={false}
                value={draft}
              />
              <p className="muted-copy">
                保存写入 Vault 里的 Markdown。Obsidian 打开同一文件即可看到修改。配图请继续用
                <code>![[图片.png]]</code>。高亮用 <code>==文字==</code>，红色点工具栏「红色」。
              </p>
            </div>
          ) : null}
          {article && !editing
            ? blocks.map((block, index) => (
                <ArticleChunk key={`${block.type}-${index}`} articlePath={article.path} block={block} />
              ))
            : null}
        </div>
      </div>
    </div>
  );
}

function ArticleChunk({ articlePath, block }: { articlePath: string; block: ArticleBlock }) {
  const [failed, setFailed] = useState(false);

  if (block.type === "text") {
    return <pre className="article-fallback">{block.text}</pre>;
  }

  if (failed) {
    return <p className="muted-copy">图片未找到：{block.src}</p>;
  }

  const href = block.remote
    ? block.src
    : `/api/research/article/asset?article=${encodeURIComponent(articlePath)}&src=${encodeURIComponent(block.src)}`;

  return (
    <figure className="article-figure">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt={block.alt} src={href} onError={() => setFailed(true)} />
    </figure>
  );
}
