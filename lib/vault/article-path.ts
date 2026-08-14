export function isVaultArticlePath(relativePath: string): boolean {
  const normalized = relativePath.replaceAll("\\", "/").replace(/^\/+/, "");
  return normalized.startsWith("Articles/") && !normalized.includes("..") && normalized.endsWith(".md");
}
