"use client";

import { type CSSProperties, type ReactNode } from "react";
import { parseTables } from "@/lib/vault/markdown";

const COLOR_OPEN = /<span\s+style="color:\s*([^";]+);?"\s*>/i;

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern =
    /(<span\s+style="color:\s*[^";]+;?"\s*>[\s\S]*?<\/span>|\*\*[^*]+\*\*|==[^=]+==|~~[^~]+~~|`[^`]+`|\[[^\]]+\]\([^)]+\))/gi;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const token = match[0];
    const colorOpen = token.match(/^<span\s+style="color:\s*([^";]+);?"\s*>/i);
    if (colorOpen) {
      const inner = token.replace(/^<span[^>]*>/i, "").replace(/<\/span>$/i, "");
      const color = colorOpen[1].trim();
      const red = /^#c64c4c$/i.test(color) || color.toLowerCase() === "red";
      nodes.push(
        <span
          className={red ? "article-colored is-red" : "article-colored"}
          key={`r-${key++}`}
          style={red ? undefined : colorStyle(color)}
        >
          {renderInline(inner)}
        </span>,
      );
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={`b-${key++}`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("==")) {
      nodes.push(
        <mark className="article-mark" key={`m-${key++}`}>
          {token.slice(2, -2)}
        </mark>,
      );
    } else if (token.startsWith("~~")) {
      nodes.push(
        <del className="article-strike" key={`s-${key++}`}>
          {token.slice(2, -2)}
        </del>,
      );
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

function colorStyle(value: string): CSSProperties | undefined {
  const color = value.trim();
  if (!color || /^#c64c4c$/i.test(color) || color.toLowerCase() === "red") return undefined;
  return { color };
}

function Heading({ level, text }: { level: number; text: string }) {
  if (level === 1) {
    return <h3 className="article-h1">{renderInline(text)}</h3>;
  }
  if (level === 2) {
    return <h4 className="article-h2">{renderInline(text)}</h4>;
  }
  return <h5 className="article-h3">{renderInline(text)}</h5>;
}

function MarkdownList({
  ordered,
  lines,
  id,
}: {
  ordered: boolean;
  lines: string[];
  id: string;
}) {
  const Tag = ordered ? "ol" : "ul";
  const strip = ordered ? /^\d+\.\s+/ : /^[-*]\s+/;
  return (
    <Tag className="article-md-list">
      {lines.map((line, lineIndex) => (
        <li key={`${id}-${lineIndex}`}>{renderInline(line.replace(strip, ""))}</li>
      ))}
    </Tag>
  );
}

function splitBalancedBlocks(value: string): string[] {
  const parts = value.replace(/\r\n/g, "\n").split(/\n{2,}/);
  const blocks: string[] = [];
  let buf = "";
  for (const part of parts) {
    const combined = buf ? `${buf}\n\n${part}` : part;
    const opens = combined.match(/<span\b/gi)?.length ?? 0;
    const closes = combined.match(/<\/span>/gi)?.length ?? 0;
    if (opens > closes) {
      buf = combined;
      continue;
    }
    blocks.push(combined);
    buf = "";
  }
  if (buf) blocks.push(buf);
  return blocks;
}

function renderColored(text: string, id: string): ReactNode {
  const open = text.match(COLOR_OPEN);
  if (!open || open.index == null) return renderPlainBlock(text, id);
  const start = open.index;
  const innerStart = start + open[0].length;
  const close = text.indexOf("</span>", innerStart);
  if (close < 0) return renderPlainBlock(text, id);

  const before = text.slice(0, start);
  const inner = text.slice(innerStart, close);
  const after = text.slice(close + 7);
  const color = open[1].trim();
  const red = /^#c64c4c$/i.test(color) || color.toLowerCase() === "red";

  return (
    <div className="article-block" key={id}>
      {before.trim() ? renderPlainBlock(before, `${id}-before`) : null}
      <div className={red ? "article-colored is-red" : "article-colored"} style={red ? undefined : { color }}>
        <ArticleMarkdown value={inner} />
      </div>
      {after.trim() ? renderPlainBlock(after, `${id}-after`) : null}
    </div>
  );
}

function renderPlainBlock(trimmed: string, id: string): ReactNode {
  if (/^---+$/.test(trimmed)) {
    return <hr className="article-hr" key={id} />;
  }

  const lines = trimmed.split("\n");
  const callout = lines[0]?.match(/^>\s*\[!([^\]]+)\]\s*(.*)$/);
  if (callout && lines.every((line) => /^>\s?/.test(line) || !line.trim())) {
    const kind = callout[1].trim().toLowerCase();
    const title = callout[2].trim();
    const body = lines
      .slice(1)
      .map((line) => line.replace(/^>\s?/, ""))
      .join("\n")
      .trim();
    return (
      <blockquote className={`article-callout is-${kind}`} key={id}>
        {title ? <strong>{renderInline(title)}</strong> : null}
        {body ? <p>{renderInline(body)}</p> : null}
      </blockquote>
    );
  }

  const heading = lines[0]?.match(/^(#{1,3})\s+(.+)$/);
  if (heading) {
    const title = heading[2].trim();
    const rest = lines.slice(1).join("\n").trim();
    if (!rest) {
      return <Heading key={id} level={heading[1].length} text={title} />;
    }
    return (
      <div className="article-block" key={id}>
        <Heading level={heading[1].length} text={title} />
        {renderBlock(rest, `${id}-rest`)}
      </div>
    );
  }

  const nonempty = lines.filter((line) => line.trim());
  const table = parseTables(trimmed)[0];
  if (table && nonempty[0]?.includes("|") && nonempty.length >= 2) {
    return (
      <div className="article-table-wrap" key={id}>
        <table className="article-table">
          <thead>
            <tr>
              {table.headers.map((header, index) => (
                <th key={`${id}-h-${index}`}>{renderInline(header)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr key={`${id}-r-${rowIndex}`}>
                {table.headers.map((_, colIndex) => (
                  <td key={`${id}-c-${rowIndex}-${colIndex}`}>{renderInline(row[colIndex] ?? "")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (nonempty.length >= 2) {
    const rest = nonempty.slice(1);
    if (rest.every((line) => /^[-*]\s+/.test(line))) {
      return (
        <div className="article-block" key={id}>
          <p className="article-paragraph">{renderInline(nonempty[0])}</p>
          <MarkdownList id={`${id}-ul`} lines={rest} ordered={false} />
        </div>
      );
    }
    if (rest.every((line) => /^\d+\.\s+/.test(line))) {
      return (
        <div className="article-block" key={id}>
          <p className="article-paragraph">{renderInline(nonempty[0])}</p>
          <MarkdownList id={`${id}-ol`} lines={rest} ordered />
        </div>
      );
    }
  }

  if (lines.every((line) => /^>\s?/.test(line) || !line.trim())) {
    const quote = lines.map((line) => line.replace(/^>\s?/, "")).join("\n");
    return (
      <blockquote className="article-quote" key={id}>
        {renderInline(quote)}
      </blockquote>
    );
  }

  if (nonempty.length > 0 && nonempty.every((line) => /^[-*]\s+/.test(line))) {
    return <MarkdownList id={id} key={id} lines={nonempty} ordered={false} />;
  }
  if (nonempty.length > 0 && nonempty.every((line) => /^\d+\.\s+/.test(line))) {
    return <MarkdownList id={id} key={id} lines={nonempty} ordered />;
  }

  return (
    <p className="article-paragraph" key={id}>
      {renderInline(lines.join("\n")).flatMap((node, index) =>
        typeof node === "string"
          ? node.split("\n").flatMap((piece, pieceIndex, all) =>
              pieceIndex < all.length - 1
                ? [piece, <br key={`${id}-br-${index}-${pieceIndex}`} />]
                : [piece],
            )
          : [node],
      )}
    </p>
  );
}

function renderBlock(trimmed: string, id: string): ReactNode {
  if (COLOR_OPEN.test(trimmed)) return renderColored(trimmed, id);
  return renderPlainBlock(trimmed, id);
}

export function ArticleMarkdown({ value }: { value: string }) {
  return (
    <>
      {splitBalancedBlocks(value).map((block, index) => {
        const trimmed = block.trim();
        if (!trimmed) return null;
        return renderBlock(trimmed, `b-${index}`);
      })}
    </>
  );
}
