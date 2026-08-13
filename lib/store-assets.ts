import fs from "node:fs";
import path from "node:path";
import { resolveAssetsDir, resolveDatabaseDir } from "@/lib/db";
import {
  isVaultImagePath,
  mimeTypeForPath,
} from "@/lib/vault/assets";

function isInside(root: string, absolutePath: string) {
  const prefix = path.resolve(root) + path.sep;
  return path.resolve(absolutePath).startsWith(prefix);
}

export function vaultRelativeToAssetPath(vaultRelativePath: string) {
  const normalized = vaultRelativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.startsWith("Articles/attachments/")) {
    return `assets/${normalized.slice("Articles/attachments/".length)}`;
  }
  if (normalized.startsWith("Articles/")) {
    return `assets/${normalized.slice("Articles/".length)}`;
  }
  return `assets/${path.basename(normalized)}`;
}

export function readStoreAsset(relativePath: string) {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (
    normalized.includes("..") ||
    !normalized.startsWith("assets/") ||
    !isVaultImagePath(normalized)
  ) {
    throw new Error("只能读取同步文件夹 assets 下的图片。");
  }

  const root = resolveDatabaseDir();
  const absolute = path.resolve(root, normalized);
  if (!isInside(root, absolute) || !fs.existsSync(absolute)) {
    throw new Error(`找不到图片：${normalized}`);
  }

  return {
    absolutePath: absolute,
    relativePath: normalized,
    mimeType: mimeTypeForPath(absolute),
    buffer: fs.readFileSync(absolute),
  };
}

export function countStoreAssets() {
  const assetsDir = resolveAssetsDir();
  if (!fs.existsSync(assetsDir)) return 0;

  let count = 0;
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const next = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(next);
      else if (isVaultImagePath(entry.name)) count += 1;
    }
  };
  walk(assetsDir);
  return count;
}
