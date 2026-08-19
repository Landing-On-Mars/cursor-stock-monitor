"use client";

import { useRef } from "react";
import { MarkdownToolbar } from "@/components/markdown-toolbar";

type MarkdownEditorProps = {
  value: string;
  onChange: (next: string) => void;
  compact?: boolean;
  placeholder?: string;
};

export function MarkdownEditor({
  value,
  onChange,
  compact,
  placeholder,
}: MarkdownEditorProps) {
  const editorRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div className={compact ? "article-editor-wrap is-compact" : "article-editor-wrap"}>
      <MarkdownToolbar onChange={onChange} textareaRef={editorRef} value={value} />
      <textarea
        className="article-editor"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        ref={editorRef}
        spellCheck={false}
        value={value}
      />
    </div>
  );
}
