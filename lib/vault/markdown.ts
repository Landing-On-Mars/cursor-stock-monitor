export type MarkdownSection = {
  heading: string;
  content: string;
};

export type MarkdownTable = {
  headers: string[];
  rows: string[][];
};

export function splitSections(body: string): MarkdownSection[] {
  const sections: MarkdownSection[] = [];
  const parts = body.split(/^##\s+/m);
  const preamble = parts.shift()?.trim();
  if (preamble) sections.push({ heading: "", content: preamble });

  for (const part of parts) {
    const newline = part.indexOf("\n");
    const heading = (newline === -1 ? part : part.slice(0, newline)).trim();
    const content = (newline === -1 ? "" : part.slice(newline + 1)).trim();
    sections.push({ heading, content });
  }

  return sections;
}

export function findSection(
  sections: MarkdownSection[],
  pattern: RegExp,
): MarkdownSection | undefined {
  return sections.find((section) => pattern.test(section.heading));
}

export function parseTables(content: string): MarkdownTable[] {
  const lines = content.split(/\r?\n/);
  const tables: MarkdownTable[] = [];
  let block: string[] = [];

  const flush = () => {
    if (block.length >= 2) {
      const table = rowsFromBlock(block);
      if (table) tables.push(table);
    }
    block = [];
  };

  for (const line of lines) {
    if (line.trim().startsWith("|")) {
      block.push(line);
    } else {
      flush();
    }
  }
  flush();
  return tables;
}

export function extractBullets(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*[-*]\s+(.*)$/)?.[1]?.trim())
    .filter((line): line is string => Boolean(line));
}

export function firstItalic(content: string): string {
  const match = content.match(/_([^_\n][\s\S]*?[^_\n])_/);
  return match?.[1]?.replace(/\s+/g, " ").trim() ?? "";
}

export function labeledBullets(content: string, label: RegExp): string[] {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((line) => label.test(line.replace(/\*+/g, "")));
  if (start === -1) return [];

  const bullets: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\s*[-*]\s+/.test(line)) {
      bullets.push(line.replace(/^\s*[-*]\s+/, "").trim());
      continue;
    }
    if (line.trim() === "") continue;
    if (line.startsWith("**") || line.startsWith("##") || line.startsWith("---")) break;
  }
  return bullets;
}

function rowsFromBlock(block: string[]): MarkdownTable | null {
  const parsed = block
    .filter((line) => !/^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(line))
    .map((line) =>
      line
        .replace(/^\s*\|/, "")
        .replace(/\|\s*$/, "")
        .split("|")
        .map((cell) => cell.trim()),
    )
    .filter((row) => row.some((cell) => cell.length > 0));

  if (parsed.length < 2) return null;
  const [headers, ...rows] = parsed;
  return { headers, rows };
}
