import fs from "node:fs";
import path from "node:path";

const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".bmp",
]);

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
};

function isInsideVault(vaultRoot: string, absolutePath: string) {
  const root = path.resolve(vaultRoot) + path.sep;
  return path.resolve(absolutePath).startsWith(root);
}

function articleAttachmentPrefix(articleRelativePath: string) {
  const base = path.basename(articleRelativePath, ".md");
  return base.split("：")[0].split(":")[0].trim();
}

export function isVaultImagePath(relativePath: string) {
  return IMAGE_EXTENSIONS.has(path.extname(relativePath).toLowerCase());
}

export function mimeTypeForPath(filePath: string) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

function withAlternateExtensions(relativePath: string) {
  const ext = path.extname(relativePath);
  const stem = relativePath.slice(0, -ext.length);
  const alternatives = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
  return [relativePath, ...alternatives.map((next) => `${stem}${next}`)].filter(
    (value, index, list) => list.indexOf(value) === index,
  );
}

/** Resolve Obsidian / markdown image targets to a vault-relative path. */
export function resolveVaultImage(
  vaultRoot: string,
  rawTarget: string,
  articleRelativePath: string,
) {
  const cleaned = decodeURIComponent(rawTarget.split("|")[0].trim())
    .replace(/\\/g, "/")
    .replace(/^\.?\//, "");

  if (!cleaned || cleaned.includes("..") || !isVaultImagePath(cleaned)) {
    return null;
  }

  const prefix = articleAttachmentPrefix(articleRelativePath);
  const baseCandidates = [
    cleaned.startsWith("Articles/") ? cleaned : null,
    cleaned.startsWith("attachments/") ? `Articles/${cleaned}` : null,
    `Articles/attachments/${cleaned}`,
    `Articles/${cleaned}`,
    !cleaned.includes("/") && prefix
      ? `Articles/attachments/${prefix}/${cleaned}`
      : null,
  ].filter((value): value is string => Boolean(value));

  const candidates = baseCandidates.flatMap(withAlternateExtensions);

  for (const relative of candidates) {
    const absolute = path.join(vaultRoot, relative);
    if (isInsideVault(vaultRoot, absolute) && fs.existsSync(absolute)) {
      return relative.replace(/\\/g, "/");
    }
  }

  return null;
}

export function assetUrlForVaultPath(relativePath: string) {
  return `/api/vault/asset?path=${encodeURIComponent(relativePath)}`;
}

/**
 * Rewrite Obsidian embeds and relative markdown images into dashboard asset URLs.
 * Keeps unresolved embeds visible so missing files are obvious.
 */
export function rewriteArticleMedia(
  content: string,
  vaultRoot: string,
  articleRelativePath: string,
) {
  const rewriteTarget = (raw: string) => {
    const resolved = resolveVaultImage(vaultRoot, raw, articleRelativePath);
    return resolved ? assetUrlForVaultPath(resolved) : null;
  };

  // Nested broken form: ![alt](![[path]])
  let next = content.replace(
    /!\[([^\]]*)\]\(\s*!\[\[([^\]]+)\]\]\s*\)/g,
    (_match, alt: string, embed: string) => {
      const url = rewriteTarget(embed);
      return url ? `![${alt || path.basename(embed)}](${url})` : `![[${embed}]]`;
    },
  );

  next = next.replace(/!\[\[([^\]]+)\]\]/g, (_match, embed: string) => {
    const url = rewriteTarget(embed);
    if (!url) return `![[${embed}]]`;
    return `![${path.basename(embed.split("|")[0])}](${url})`;
  });

  next = next.replace(
    /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
    (match, alt: string, target: string) => {
      if (target.startsWith("/api/vault/asset") || /^https?:\/\//i.test(target)) {
        return match;
      }
      const url = rewriteTarget(target);
      return url ? `![${alt}](${url})` : match;
    },
  );

  return next;
}

export function readVaultAsset(vaultRoot: string, relativePath: string) {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (
    normalized.includes("..") ||
    !normalized.startsWith("Articles/") ||
    !isVaultImagePath(normalized)
  ) {
    throw new Error("只能读取 Articles 下的图片资源。");
  }

  const absolute = path.resolve(vaultRoot, normalized);
  if (!isInsideVault(vaultRoot, absolute) || !fs.existsSync(absolute)) {
    throw new Error(`找不到图片：${normalized}`);
  }

  return {
    absolutePath: absolute,
    relativePath: normalized,
    mimeType: mimeTypeForPath(absolute),
    buffer: fs.readFileSync(absolute),
  };
}
