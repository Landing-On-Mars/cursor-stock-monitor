export function quoteYaml(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function replaceMarkdownBody(source: string, body: string) {
  const normalized = `${body.replace(/\r\n/g, "\n").trimEnd()}\n`;
  if (!source.startsWith("---")) return normalized;
  const end = source.indexOf("\n---", 3);
  if (end < 0) return normalized;
  const header = source.slice(0, end + 4).replace(/[ \t]+$/u, "");
  return `${header}\n\n${normalized}`;
}

export function replaceFrontmatterScalar(source: string, key: string, value: string) {
  if (!source.startsWith("---")) return source;
  const end = source.indexOf("\n---", 3);
  if (end < 0) return source;
  const header = source.slice(0, end);
  const rest = source.slice(end);
  const line = `${key}: ${quoteYaml(value)}`;
  const pattern = new RegExp(`^${key}\\s*:.*$`, "m");
  const nextHeader = pattern.test(header)
    ? header.replace(pattern, line)
    : `${header.replace(/\s+$/, "")}\n${line}`;
  return `${nextHeader}${rest}`;
}
