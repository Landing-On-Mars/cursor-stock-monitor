import { NextResponse } from "next/server";
import { databaseStatus, getDb } from "@/lib/db";
import { notesStatus, resolveNotesRoot } from "@/lib/notes-root";
import { copyJournalToDriveVault } from "@/lib/store-import";
import {
  articleCountBySymbol,
  invalidateArticleCache,
  scanVaultArticles,
} from "@/lib/vault/articles";
import { resolveVaultPath, vaultStatus } from "@/lib/vault/path";
import { scanVaultStocks } from "@/lib/vault/stocks";
import { listWatchlistItems, upsertVaultWatchlistItem } from "@/lib/watchlist-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const journal = vaultStatus();
  const notes = notesStatus();
  const store = databaseStatus();
  const notesRoot = notes.notesRoot;
  const payload = {
    ...journal,
    notesRoot,
    available: Boolean(notesRoot || journal.resolved),
    storedArticleCount: notes.articleCount,
    storedAssetCount: notes.imageCount,
    watchlistCount: listWatchlistItems().length,
    stockCount: 0,
    articleCount: notes.articleCount,
    coreCount: 0,
    watchCount: 0,
    archiveCount: 0,
    databaseDir: store.configuredDir || store.filePath,
  };

  const stockRoot = notesRoot || journal.resolved;
  if (!stockRoot) {
    return NextResponse.json(payload);
  }

  try {
    const stocks = scanVaultStocks(stockRoot);
    return NextResponse.json({
      ...payload,
      stockCount: stocks.length,
      coreCount: stocks.filter((stock) => stock.category === "CORE").length,
      watchCount: stocks.filter((stock) => stock.category === "WATCH").length,
      archiveCount: stocks.filter((stock) => stock.category === "ARCHIVE").length,
      articleCount: notes.articleCount || scanVaultArticles(stockRoot).length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ...payload,
        error: error instanceof Error ? error.message : "Vault 扫描失败。",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let body: { replace?: boolean; vaultPath?: string; copyFromJournal?: boolean } =
    {};
  try {
    body = (await request.json()) as {
      replace?: boolean;
      vaultPath?: string;
      copyFromJournal?: boolean;
    };
  } catch {
    body = {};
  }

  const journalRoot = resolveVaultPath(body.vaultPath);
  let notesRoot = resolveNotesRoot();

  try {
    invalidateArticleCache();
    if (body.copyFromJournal) {
      if (!journalRoot) {
        return NextResponse.json(
          { error: "未找到 Journal，无法拷入 Drive Vault。" },
          { status: 404 },
        );
      }
      const copied = copyJournalToDriveVault(journalRoot);
      notesRoot = resolveNotesRoot() || copied.notesRoot;
    }

    if (!notesRoot) {
      return NextResponse.json(
        {
          error:
            "还没有 Drive Vault。请先保存 Google Drive 文件夹；若 Vault 为空，再从 Journal 拷入一次。",
        },
        { status: 404 },
      );
    }

    const stocks = scanVaultStocks(notesRoot);
    const articleCounts = articleCountBySymbol(notesRoot);

    const importStocks = getDb().transaction(() => {
      if (body.replace) {
        getDb().prepare("DELETE FROM watchlist_items").run();
      }

      for (const stock of stocks) {
        upsertVaultWatchlistItem({
          symbol: stock.symbol,
          name: stock.name,
          market: stock.market,
          category: stock.category,
          note: "",
          notePath: stock.notePath,
          exchange: stock.exchange,
          currency: stock.currency,
          industries: stock.industries,
          tags: stock.tags,
          thesis: stock.thesis,
          articleCount: articleCounts.get(stock.symbol.toUpperCase()) ?? 0,
        });
      }

      getDb()
        .prepare(
          `INSERT INTO app_meta (key, value) VALUES ('vault_imported_at', ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        )
        .run(new Date().toISOString());
    });

    importStocks();

    const items = listWatchlistItems();
    const notes = notesStatus();
    return NextResponse.json({
      ok: true,
      vaultPath: journalRoot,
      notesRoot,
      imported: stocks.length,
      articles: notes.articleCount,
      assets: notes.imageCount,
      core: items.filter((item) => item.category === "CORE").length,
      watch: items.filter((item) => item.category === "WATCH").length,
      archive: items.filter((item) => item.category === "ARCHIVE").length,
      items,
    });
  } catch (error) {
    console.error("Vault import failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "导入失败。" },
      { status: 500 },
    );
  }
}
