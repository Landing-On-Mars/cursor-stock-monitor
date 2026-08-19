"use client";

import type { RefObject } from "react";
import {
  Baseline,
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  List,
  Minus,
  Quote,
} from "lucide-react";

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

  function prefixLines(marker: string, placeholder: string) {
    apply((textarea) => {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const lineEnd =
        end > start && value[end - 1] === "\n"
          ? end - 1
          : (() => {
              const nl = value.indexOf("\n", end);
              return nl < 0 ? value.length : nl;
            })();
      const block = value.slice(lineStart, lineEnd);
      const lines = block.length > 0 ? block.split("\n") : [""];
      const already =
        lines.some((line) => line.startsWith(marker)) &&
        lines.every((line) => line.startsWith(marker) || line.trim() === "");
      const nextLines = lines.map((line) => {
        if (already) {
          return line.startsWith(marker) ? line.slice(marker.length) : line;
        }
        const stripped = line.replace(/^(>\s+|[-*]\s+)/, "");
        return `${marker}${stripped || placeholder}`;
      });
      const nextBlock = nextLines.join("\n");
      const next = `${value.slice(0, lineStart)}${nextBlock}${value.slice(lineEnd)}`;
      return { next, cursor: lineStart, length: nextBlock.length };
    });
  }

  function insertDivider() {
    apply((textarea) => {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = value.slice(0, start).replace(/[ \t]+$/u, "");
      const after = value.slice(end).replace(/^[ \t]+/u, "");
      const lead =
        before.length === 0 || before.endsWith("\n\n")
          ? ""
          : before.endsWith("\n")
            ? "\n"
            : "\n\n";
      const trail =
        after.length === 0 || after.startsWith("\n\n")
          ? ""
          : after.startsWith("\n")
            ? "\n"
            : "\n\n";
      const inserted = `${lead}---${trail}`;
      const next = `${before}${inserted}${after}`;
      return { next, cursor: before.length + inserted.length, length: 0 };
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
      <button onClick={() => wrap("**", "**", "粗体")} title="粗体" type="button">
        <Bold size={15} />
        粗体
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
      <button
        onClick={() => prefixLines("> ", "引用")}
        title="引用"
        type="button"
      >
        <Quote size={15} />
        引用
      </button>
      <button
        onClick={() => prefixLines("- ", "条目")}
        title="无序列表"
        type="button"
      >
        <List size={15} />
        列表
      </button>
      <button onClick={() => insertDivider()} title="分割线" type="button">
        <Minus size={15} />
        分割线
      </button>
    </div>
  );
}
