"use client";

import { FileText, LoaderCircle, Pencil, Save, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

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
  rawContent?: string;
  author: string;
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

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(<strong key={`b-${key++}`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      nodes.push(<code key={`c-${key++}`}>{token.slice(1, -1)}</code>);
    } else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) {
        nodes.push(
          <a href={link[2]} key={`a-${key++}`} rel="noreferrer" target="_blank">
            {link[1]}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    }
    last = match.index + token.length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function MarkdownText({ value }: { value: string }) {
  const blocks = value.replace(/\r\n/g, "\n").split(/\n{2,}/);

  return (
    <>
      {blocks.map((block, index) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        if (/^---+$/.test(trimmed)) {
          return <hr className="article-hr" key={`hr-${index}`} />;
        }

        const heading = trimmed.match(/^(#{1,3})\s+([\s\S]+)$/);
        if (heading) {
          const level = heading[1].length;
          const text = heading[2].replace(/\n/g, " ");
          if (level === 1) {
            return (
              <h3 className="article-h1" key={`h-${index}`}>
                {renderInline(text)}
              </h3>
            );
          }
          if (level === 2) {
            return (
              <h4 className="article-h2" key={`h-${index}`}>
                {renderInline(text)}
              </h4>
            );
          }
          return (
            <h5 className="article-h3" key={`h-${index}`}>
              {renderInline(text)}
            </h5>
          );
        }

        if (trimmed.startsWith("> ")) {
          const quote = trimmed
            .split("\n")
            .map((line) => line.replace(/^>\s?/, ""))
            .join("\n");
          return (
            <blockquote className="article-quote" key={`q-${index}`}>
              {renderInline(quote)}
            </blockquote>
          );
        }

        return (
          <p className="article-paragraph" key={`p-${index}`}>
            {trimmed.split("\n").map((line, lineIndex, lines) => (
              <span key={`l-${index}-${lineIndex}`}>
                {renderInline(line)}
                {lineIndex < lines.length - 1 ? <br /> : null}
              </span>
            ))}
          </p>
        );
      })}
    </>
  );
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
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
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
      setEditing(false);
      try {
        const response = await fetch(
          `/api/vault/articles/content?path=${encodeURIComponent(path)}`,
          { cache: "no-store" },
        );
        if (!response.ok) throw new Error(await readError(response));
        const data = (await response.json()) as ArticleDetail;
        if (!active) return;
        setDetail(data);
        setDraft(data.rawContent || "");
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

  async function saveDraft() {
    if (!article) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/vault/articles/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: article.path, content: draft }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const data = (await response.json()) as ArticleDetail;
      setDetail(data);
      setDraft(data.rawContent || draft);
      setEditing(false);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  if (!article) return null;

  return (
    <div className="modal-backdrop article-reader-backdrop" role="presentation" onMouseDown={onClose}>
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
            {detail && !editing ? (
              <button
                className="btn"
                onClick={() => {
                  setDraft(detail.rawContent || "");
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
                    setDraft(detail?.rawContent || "");
                    setEditing(false);
                    setError("");
                  }}
                  type="button"
                >
                  取消
                </button>
              </>
            ) : null}
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
          ) : error && !detail ? (
            <div className="inline-error">{error}</div>
          ) : editing ? (
            <>
              {error ? <div className="inline-error">{error}</div> : null}
              <textarea
                className="article-editor"
                onChange={(event) => setDraft(event.target.value)}
                spellCheck={false}
                value={draft}
              />
              <p className="settings-hint" style={{ padding: "8px 0 0" }}>
                保存写入 Google Drive 里的 Markdown。Obsidian 打开同一文件即可看到修改。配图请继续用
                <code>![[图片.png]]</code>。
              </p>
            </>
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
                ) : part.value ? (
                  <MarkdownText key={`text-${index}`} value={part.value} />
                ) : null,
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
