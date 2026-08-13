import fs from "node:fs";
import path from "node:path";
import { resolveDatabaseDir } from "@/lib/db";

export const NOTES_FOLDER = "Vault";

export function notesRootPath() {
  return path.join(resolveDatabaseDir(), NOTES_FOLDER);
}

export function resolveNotesRoot() {
  const root = notesRootPath();
  if (fs.existsSync(path.join(root, "Articles"))) {
    return root;
  }
  return null;
}

export function notesRootOrThrow() {
  const root = resolveNotesRoot();
  if (!root) {
    throw new Error("还没有 Drive 笔记库。请先在设置中保存 Google Drive 文件夹。");
  }
  return root;
}

function countMarkdown(dir: string) {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter((name) => name.endsWith(".md")).length;
}

function countImages(dir: string) {
  if (!fs.existsSync(dir)) return 0;
  const image = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp"]);
  let total = 0;
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const next = path.join(current, entry.name);
      if (entry.isDirectory()) walk(next);
      else if (image.has(path.extname(entry.name).toLowerCase())) total += 1;
    }
  };
  walk(dir);
  return total;
}

export function notesStatus() {
  const root = resolveNotesRoot();
  const articlesDir = root ? path.join(root, "Articles") : "";
  return {
    notesRoot: root,
    articleCount: root ? countMarkdown(articlesDir) : 0,
    imageCount: root ? countImages(articlesDir) : 0,
  };
}
