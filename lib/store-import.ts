import fs from "node:fs";
import path from "node:path";
import { notesRootPath } from "@/lib/notes-root";
import { invalidateArticleCache } from "@/lib/vault/articles";

function countMarkdown(dir: string) {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter((name) => name.endsWith(".md")).length;
}

function copyFolder(journalRoot: string, notesRoot: string, folder: string) {
  const from = path.join(journalRoot, folder);
  if (!fs.existsSync(from)) return;
  fs.cpSync(from, path.join(notesRoot, folder), { recursive: true, force: true });
}

export function copyJournalToDriveVault(journalRoot: string) {
  const articlesFrom = path.join(journalRoot, "Articles");
  if (!fs.existsSync(articlesFrom)) {
    throw new Error(`Journal 里找不到 Articles 目录：${articlesFrom}`);
  }

  const notesRoot = notesRootPath();
  fs.mkdirSync(notesRoot, { recursive: true });

  copyFolder(journalRoot, notesRoot, "Articles");
  copyFolder(journalRoot, notesRoot, "Stocks");
  copyFolder(journalRoot, notesRoot, ".workbuddy");

  const obsidianFrom = path.join(journalRoot, ".obsidian");
  const obsidianTo = path.join(notesRoot, ".obsidian");
  if (fs.existsSync(obsidianFrom) && !fs.existsSync(obsidianTo)) {
    fs.cpSync(obsidianFrom, obsidianTo, { recursive: true });
  } else {
    fs.mkdirSync(obsidianTo, { recursive: true });
  }

  invalidateArticleCache();

  const articlesDir = path.join(notesRoot, "Articles");
  return {
    notesRoot,
    articleCount: countMarkdown(articlesDir),
  };
}
