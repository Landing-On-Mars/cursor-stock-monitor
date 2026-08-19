export const ARTICLE_IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"]);

export type ArticleBlock =
  | { type: "text"; text: string }
  | { type: "image"; src: string; alt: string; remote: boolean };

export function normalizeVaultRelative(relativePath: string): string {
  return relativePath.replaceAll("\\", "/").replace(/^\/+/, "");
}

export function isVaultArticleAssetPath(relativePath: string): boolean {
  const normalized = normalizeVaultRelative(relativePath);
  if (!normalized.startsWith("Articles/") || normalized.includes("..")) return false;
  const ext = extension(normalized);
  return ARTICLE_IMAGE_EXTS.has(ext);
}

export function isRemoteAsset(src: string): boolean {
  return /^https?:\/\//i.test(src.trim());
}

export function wikiEmbedSrc(raw: string): string {
  return raw.split("|")[0]?.trim() ?? "";
}

export function articleAssetCandidates(articlePath: string, src: string): string[] {
  const article = normalizeVaultRelative(articlePath);
  const target = normalizeVaultRelative(wikiEmbedSrc(src)).replace(/^\.\//, "");
  if (!target || target.includes("..")) return [];

  const articleDir = article.replace(/\/[^/]+$/, "");
  const fileName = target.split("/").pop() ?? target;
  const folder = target.includes("/") ? target.slice(0, target.lastIndexOf("/")) : "";

  const candidates = [
    target,
    target.startsWith("Articles/") ? target : `Articles/${target}`,
    `Articles/attachments/${target}`,
    folder ? `Articles/attachments/${folder}/${fileName}` : "",
    `${articleDir}/${target}`,
    `${articleDir}/${fileName}`,
    `Articles/attachments/${fileName}`,
  ].filter(Boolean);

  return [...new Set(candidates)].filter(isVaultArticleAssetPath);
}

export function splitArticleBody(raw: string): ArticleBlock[] {
  const body = raw.replace(/^---[\s\S]*?---\s*/, "").trim();
  if (!body) return [{ type: "text", text: "（空文章）" }];

  const pattern = /!\[\[([^\]]+)\]\]|!\[([^\]]*)\]\(([^)]+)\)/g;
  const blocks: ArticleBlock[] = [];
  let cursor = 0;

  for (const match of body.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      blocks.push({ type: "text", text: body.slice(cursor, index) });
    }

    const wiki = match[1]?.trim();
    const mdAlt = match[2] ?? "";
    const mdSrc = match[3]?.trim() ?? "";
    const src = wiki ? wikiEmbedSrc(wiki) : mdSrc;
    const ext = extension(src.split("?")[0] ?? src);

    if (src && (isRemoteAsset(src) || ARTICLE_IMAGE_EXTS.has(ext))) {
      blocks.push({
        type: "image",
        src,
        alt: mdAlt || src.split("/").pop() || "图片",
        remote: isRemoteAsset(src),
      });
    } else {
      blocks.push({ type: "text", text: match[0] });
    }

    cursor = index + match[0].length;
  }

  if (cursor < body.length) {
    blocks.push({ type: "text", text: body.slice(cursor) });
  }

  return blocks;
}

function extension(value: string): string {
  const base = value.split("/").pop() ?? value;
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot).toLowerCase() : "";
}
