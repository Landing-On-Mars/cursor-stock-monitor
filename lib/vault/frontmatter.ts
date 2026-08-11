export type FrontmatterValue = string | string[] | number | boolean | null;

export type ParsedMarkdown = {
  data: Record<string, FrontmatterValue>;
  content: string;
};

function unquote(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseScalar(raw: string): FrontmatterValue {
  const value = raw.trim();
  if (!value || value === "[]") return value === "[]" ? [] : "";
  if (value === "null" || value === "~") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return unquote(value);
}

/** Lightweight YAML frontmatter parser for Vault stock/article notes. */
export function parseFrontmatter(source: string): ParsedMarkdown {
  if (!source.startsWith("---")) {
    return { data: {}, content: source };
  }

  const end = source.indexOf("\n---", 3);
  if (end < 0) {
    return { data: {}, content: source };
  }

  const block = source.slice(3, end).replace(/^\r?\n/, "");
  const content = source.slice(end + 4).replace(/^\r?\n/, "");
  const data: Record<string, FrontmatterValue> = {};
  const lines = block.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim() || line.trimStart().startsWith("#")) continue;

    const match = /^(?:[A-Za-z_][\w]*)\s*:/.exec(line);
    if (!match) continue;

    const key = line.slice(0, line.indexOf(":")).trim();
    const remainder = line.slice(line.indexOf(":") + 1).trim();

    if (remainder && remainder !== "|" && remainder !== ">") {
      data[key] = parseScalar(remainder);
      continue;
    }

    const items: string[] = [];
    let nested = "";
    while (index + 1 < lines.length) {
      const next = lines[index + 1];
      if (/^\s*-\s+/.test(next)) {
        index += 1;
        items.push(unquote(next.replace(/^\s*-\s+/, "")));
        continue;
      }
      if (/^\s+\S/.test(next) && !/^\s*-\s+/.test(next)) {
        index += 1;
        nested += `${next.trim()}\n`;
        continue;
      }
      break;
    }

    if (items.length > 0) {
      data[key] = items;
    } else if (nested) {
      data[key] = nested.trim();
    } else {
      data[key] = "";
    }
  }

  return { data, content };
}

export function asString(value: FrontmatterValue | undefined, fallback = "") {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

export function asStringArray(value: FrontmatterValue | undefined) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }
  if (typeof value === "string" && value) return [value];
  return [];
}

export function extractThesis(content: string) {
  const thesisMatch = content.match(
    /##\s*Investment thesis\s*([\s\S]*?)(?=\n##\s|\n---\s*$|$)/i,
  );
  if (!thesisMatch) return "";

  const body = thesisMatch[1]
    .replace(/\*\*Key metrics to watch:\*\*[\s\S]*$/i, "")
    .replace(/^_+|\_+$/g, "")
    .replace(/[*_]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return body.slice(0, 280);
}
