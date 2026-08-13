"use client";

import { Lightbulb, LoaderCircle, Save, X } from "lucide-react";
import { FormEvent, useRef, useState } from "react";
import type { ArticleSummary } from "@/components/article-reader";
import { MarkdownToolbar } from "@/components/markdown-toolbar";

const DEFAULT_BODY = `## 观点


## 依据


## 后续跟踪

`;

const STANCES = [
  { value: "", label: "未标立场" },
  { value: "看多", label: "看多" },
  { value: "看空", label: "看空" },
  { value: "观望", label: "观望" },
] as const;

function todayLocal() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

async function readError(response: Response) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? "保存失败";
}

type IdeaComposerProps = {
  symbol: string;
  name: string;
  onClose: () => void;
  onCreated: (article: ArticleSummary) => void;
};

export function IdeaComposer({
  symbol,
  name,
  onClose,
  onCreated,
}: IdeaComposerProps) {
  const [date, setDate] = useState(todayLocal);
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("我的想法");
  const [stance, setStance] = useState("");
  const [content, setContent] = useState(DEFAULT_BODY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const editorRef = useRef<HTMLTextAreaElement>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("请填写标题。");
      return;
    }

    const body = stance
      ? `**立场：** ${stance}\n\n${content.replace(/\r\n/g, "\n").trim()}\n`
      : content;

    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/vault/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          date,
          content: body,
          symbols: [symbol],
          source: source.trim() || "我的想法",
        }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const article = (await response.json()) as ArticleSummary;
      onCreated(article);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        aria-labelledby="idea-composer-title"
        aria-modal="true"
        className="modal idea-composer-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="modal-head">
          <div>
            <p className="obsidian-label" style={{ marginBottom: 6 }}>
              <Lightbulb size={13} /> {symbol} · {name}
            </p>
            <h2 id="idea-composer-title">记录一笔</h2>
          </div>
          <button aria-label="关闭" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={(event) => void onSubmit(event)}>
          {error ? <div className="inline-error">{error}</div> : null}

          <div className="form-grid">
            <label className="field">
              <span>日期</span>
              <input
                onChange={(event) => setDate(event.target.value)}
                required
                type="date"
                value={date}
              />
            </label>
            <label className="field">
              <span>来源</span>
              <input
                onChange={(event) => setSource(event.target.value)}
                placeholder="我的想法"
                value={source}
              />
            </label>
            <label className="field">
              <span>立场</span>
              <select
                onChange={(event) => setStance(event.target.value)}
                value={stance}
              >
                {STANCES.map((item) => (
                  <option key={item.label} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field field-full">
              <span>标题</span>
              <input
                onChange={(event) => setTitle(event.target.value)}
                placeholder={`${symbol} 的最新判断`}
                required
                value={title}
              />
            </label>
            <div className="field field-full">
              <span>正文</span>
              <MarkdownToolbar
                onChange={setContent}
                textareaRef={editorRef}
                value={content}
              />
              <textarea
                className="idea-composer-editor"
                onChange={(event) => setContent(event.target.value)}
                placeholder="写下观点、依据和后续跟踪"
                ref={editorRef}
                spellCheck={false}
                value={content}
              />
            </div>
          </div>

          <div className="modal-actions">
            <button className="btn" disabled={saving} onClick={onClose} type="button">
              取消
            </button>
            <button className="btn btn-primary" disabled={saving} type="submit">
              {saving ? <LoaderCircle className="spin" size={14} /> : <Save size={14} />}
              {saving ? "保存中…" : "保存到 Vault"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
