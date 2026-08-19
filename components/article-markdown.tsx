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

export function ArticleMarkdown({ value }: { value: string }) {
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

        const quoteLines = trimmed.split("\n");
        if (quoteLines.every((line) => /^>\s?/.test(line) || !line.trim())) {
          const quote = quoteLines.map((line) => line.replace(/^>\s?/, "")).join("\n");
          return (
            <blockquote className="article-quote" key={`q-${index}`}>
              {renderInline(quote)}
            </blockquote>
          );
        }

        const listLines = trimmed.split("\n").filter((line) => line.trim());
        if (listLines.length > 0 && listLines.every((line) => /^[-*]\s+/.test(line))) {
          return (
            <ul className="article-md-list" key={`ul-${index}`}>
              {listLines.map((line, lineIndex) => (
                <li key={`li-${index}-${lineIndex}`}>{renderInline(line.replace(/^[-*]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }

        if (listLines.length > 0 && listLines.every((line) => /^\d+\.\s+/.test(line))) {
          return (
            <ol className="article-md-list" key={`ol-${index}`}>
              {listLines.map((line, lineIndex) => (
                <li key={`li-${index}-${lineIndex}`}>{renderInline(line.replace(/^\d+\.\s+/, ""))}</li>
              ))}
            </ol>
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
