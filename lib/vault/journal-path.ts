import { normalizeVaultRelative } from "./article-media";

export const JOURNAL_SUFFIX = ".日志.md";

export function isStockJournalPath(relativePath: string) {
  const normalized = normalizeVaultRelative(relativePath);
  return normalized.startsWith("Stocks/") && normalized.endsWith(JOURNAL_SUFFIX);
}

export function stockJournalPath(stockRelativePath: string) {
  const normalized = normalizeVaultRelative(stockRelativePath);
  if (isStockJournalPath(normalized)) return normalized;
  return normalized.replace(/\.md$/i, JOURNAL_SUFFIX);
}
