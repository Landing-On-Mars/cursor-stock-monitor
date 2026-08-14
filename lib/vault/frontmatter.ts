export type FrontmatterValue = string | string[] | number | boolean;

export function parseFrontmatter(raw: string): {
  data: Record<string, FrontmatterValue>;
  body: string;
} {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { data: {}, body: raw };

  const data: Record<string, FrontmatterValue> = {};
  const lines = match[1].split(/\r?\n/);
  let currentKey = "";
  let currentList: string[] | null = null;

  const flushList = () => {
    if (currentKey && currentList) data[currentKey] = currentList;
    currentList = null;
  };

  for (const line of lines) {
    const listItem = line.match(/^\s+-\s+(.*)$/);
    if (listItem && currentKey) {
      if (!currentList) currentList = [];
      currentList.push(unquote(listItem[1]));
      continue;
    }

    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (kv) {
      flushList();
      currentKey = kv[1];
      const value = kv[2].trim();
      if (value === "" || value === "[]") {
        currentList = value === "[]" ? [] : [];
        if (value === "[]") {
          data[currentKey] = [];
          currentList = null;
        }
        continue;
      }
      data[currentKey] = unquote(value);
      currentList = null;
      continue;
    }
  }
  flushList();

  return { data, body: raw.slice(match[0].length) };
}

export function asString(value: FrontmatterValue | undefined): string {
  if (Array.isArray(value)) return value.join(", ");
  if (value == null) return "";
  return String(value).replace(/^['"]|['"]$/g, "").trim();
}

export function asList(value: FrontmatterValue | undefined): string[] {
  if (Array.isArray(value)) return value.map((item) => unquote(item)).filter(Boolean);
  if (typeof value === "string" && value) return [unquote(value)];
  return [];
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}
