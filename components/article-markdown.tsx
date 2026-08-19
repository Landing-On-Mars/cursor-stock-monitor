"use client";

import { type ReactNode } from "react";

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern =
    /(<span style="color:\s*(?:#c64c4c|red);?">[\s\S]*?<\/span>|\*\*[^*]+\*\*|==[^=]+==|~~[^~]+~~|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const token = match[0];
    if (token.startsWith("<span")) {
      const inner = token.replace(/^<span[^>]*>/, "").replace(/<\/span>$/, "");
      nodes.push(
        <span className="article-red" key={`r-${key++}`}>
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

function renderBlock(trimmed: string, id: string): ReactNode {
  if (/^---+$/.test(trimmed)) {
    return <hr className="article-hr" key={id} />;
  }

  const lines = trimmed.split("\n");
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
      {lines.map((line, lineIndex) => (
        <span key={`${id}-${lineIndex}`}>
          {renderInline(line)}
          {lineIndex < lines.length - 1 ? <br /> : null}
        </span>
      ))}
    </p>
  );
}

export function ArticleMarkdown({ value }: { value: string }) {
  const blocks = value.replace(/\r\n/g, "\n").split(/\n{2,}/);

  return (
    <>
      {blocks.map((block, index) => {
        const trimmed = block.trim();
        if (!trimmed) return null;
        return renderBlock(trimmed, `b-${index}`);
      })}
    </>
  );
}
