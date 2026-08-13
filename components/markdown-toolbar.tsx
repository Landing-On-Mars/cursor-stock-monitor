"use client";

import type { RefObject } from "react";
import { Baseline, Heading1, Heading2, Heading3, Highlighter } from "lucide-react";

const RED_BEFORE = '<span style="color:#c64c4c">';
const RED_AFTER = "</span>";

type MarkdownToolbarProps = {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
};

function replaceSelection(
  textarea: HTMLTextAreaElement,
  value: string,
  nextSelected: string,
  cursorOffset = 0,
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const next = `${value.slice(0, start)}${nextSelected}${value.slice(end)}`;
  const cursor = start + cursorOffset;
  return { next, cursor, length: nextSelected.length };
}

export function MarkdownToolbar({
  textareaRef,
  value,
  onChange,
}: MarkdownToolbarProps) {
  function apply(mutator: (textarea: HTMLTextAreaElement) => {
    next: string;
    cursor: number;
    length: number;
  }) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const { next, cursor, length } = mutator(textarea);
    onChange(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor + length);
    });
  }

  function wrap(before: string, after = before, placeholder = "文本") {
    apply((textarea) => {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = value.slice(start, end) || placeholder;
      const wrapped = `${before}${selected}${after}`;
      const { next } = replaceSelection(textarea, value, wrapped, before.length);
      return { next, cursor: start + before.length, length: selected.length };
    });
  }

  function heading(level: 1 | 2 | 3) {
    const marks = `${"#".repeat(level)} `;
    apply((textarea) => {
      const start = textarea.selectionStart;
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const lineEnd = value.indexOf("\n", start);
      const end = lineEnd < 0 ? value.length : lineEnd;
      const line = value.slice(lineStart, end).replace(/^#{1,6}\s+/, "");
      const nextLine = `${marks}${line || "标题"}`;
      const next = `${value.slice(0, lineStart)}${nextLine}${value.slice(end)}`;
      return {
        next,
        cursor: lineStart + marks.length,
        length: (line || "标题").length,
      };
    });
  }

  return (
    <div className="md-toolbar">
      <button onClick={() => heading(1)} title="一级标题" type="button">
        <Heading1 size={15} />
        标题
      </button>
      <button onClick={() => heading(2)} title="二级标题" type="button">
        <Heading2 size={15} />
        小标题
      </button>
      <button onClick={() => heading(3)} title="三级标题" type="button">
        <Heading3 size={15} />
        小节
      </button>
      <button onClick={() => wrap("==", "==", "高亮")} title="高亮" type="button">
        <Highlighter size={15} />
        高亮
      </button>
      <button
        className="md-toolbar-red"
        onClick={() => wrap(RED_BEFORE, RED_AFTER, "强调")}
        title="红色文字"
        type="button"
      >
        <Baseline size={15} />
        红色
      </button>
    </div>
  );
}
