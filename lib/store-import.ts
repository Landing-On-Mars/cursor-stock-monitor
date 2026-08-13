import fs from "node:fs";
import path from "node:path";
import { getDb, resolveAssetsDir } from "@/lib/db";
import {
  upsertStoredArticle,
} from "@/lib/store-articles";
import { vaultRelativeToAssetPath } from "@/lib/store-assets";
import {
  asString,
  asStringArray,
  parseFrontmatter,
} from "@/lib/vault/frontmatter";
import {
  isVaultImagePath,
  rewriteArticleMedia,
} from "@/lib/vault/assets";

function copyImageTree(vaultRoot: string) {
  const assetsDir = resolveAssetsDir();
  fs.mkdirSync(assetsDir, { recursive: true });

  const attachments = path.join(vaultRoot, "Articles", "attachments");
  if (fs.existsSync(attachments)) {
    fs.cpSync(attachments, assetsDir, { recursive: true, force: true });
  }

  const articlesDir = path.join(vaultRoot, "Articles");
  for (const name of fs.readdirSync(articlesDir)) {
    if (!isVaultImagePath(name)) continue;
    fs.copyFileSync(path.join(articlesDir, name), path.join(assetsDir, name));
  }
}

function rewriteToStoreAssets(
  content: string,
  vaultRoot: string,
  articleRelativePath: string,
) {
  const rewritten = rewriteArticleMedia(content, vaultRoot, articleRelativePath);
  return rewritten.replace(
    /\/api\/vault\/asset\?path=([^)\s]+)/g,
    (match, encoded: string) => {
      try {
        const vaultRelative = decodeURIComponent(encoded);
        if (vaultRelative.startsWith("assets/")) return match;
        const storePath = vaultRelativeToAssetPath(vaultRelative);
        return `/api/vault/asset?path=${encodeURIComponent(storePath)}`;
      } catch {
        return match;
      }
    },
  );
}

function importMarkdownArticles(vaultRoot: string) {
  const articlesDir = path.join(vaultRoot, "Articles");
  const names = fs.readdirSync(articlesDir).filter((name) => name.endsWith(".md"));
  const database = getDb();
  const upsert = database.transaction(() => {
    for (const name of names) {
      const relativePath = path.join("Articles", name).replace(/\\/g, "/");
      const sourceText = fs.readFileSync(path.join(articlesDir, name), "utf8");
      const { data, content } = parseFrontmatter(sourceText);
      const title =
        asString(data.title) ||
        name.replace(/\.md$/, "").replace(/^.*?[：:]/, "").trim() ||
        name;

      upsertStoredArticle({
        path: relativePath,
        title,
        source: asString(data.source),
        author: asString(data.author),
        publishedAt: asString(data.published_at),
        savedAt: asString(data.saved_at),
        symbols: asStringArray(data.symbols),
        industries: asStringArray(data.industries),
        status: asString(data.status, "inbox"),
        tags: asStringArray(data.tags),
        content: rewriteToStoreAssets(content.trim(), vaultRoot, relativePath),
      });
    }
  });
  upsert();
  return names.length;
}

export function importVaultArticles(vaultRoot: string) {
  copyImageTree(vaultRoot);
  const articleCount = importMarkdownArticles(vaultRoot);

  const unresolved = getDb()
    .prepare("SELECT path FROM articles WHERE content LIKE '%![[%'")
    .all() as Array<{ path: string }>;

  return {
    articleCount,
    unresolvedEmbeds: unresolved.length,
  };
}
