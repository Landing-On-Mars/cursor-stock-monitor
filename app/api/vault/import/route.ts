import { NextResponse } from "next/server";
import { databaseStatus, getDb } from "@/lib/db";
import {
  articleCountByStoredSymbol,
  storedArticleCount,
} from "@/lib/store-articles";
import { countStoreAssets } from "@/lib/store-assets";
import { importVaultArticles } from "@/lib/store-import";
import { invalidateArticleCache } from "@/lib/vault/articles";
import { resolveVaultPath, vaultStatus } from "@/lib/vault/path";
import { scanVaultStocks } from "@/lib/vault/stocks";
import { listWatchlistItems, upsertVaultWatchlistItem } from "@/lib/watchlist-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = vaultStatus();
  const store = databaseStatus();
  const payload = {
    ...status,
    storedArticleCount: storedArticleCount(),
    storedAssetCount: countStoreAssets(),
    watchlistCount: listWatchlistItems().length,
    stockCount: 0,
    articleCount: storedArticleCount(),
    coreCount: 0,
    watchCount: 0,
    archiveCount: 0,
    databaseDir: store.configuredDir || store.filePath,
  };

  if (!status.resolved) {
    return NextResponse.json(payload);
  }

  try {
    const stocks = scanVaultStocks(status.resolved);
    return NextResponse.json({
      ...payload,
      stockCount: stocks.length,
      coreCount: stocks.filter((stock) => stock.category === "CORE").length,
      watchCount: stocks.filter((stock) => stock.category === "WATCH").length,
      archiveCount: stocks.filter((stock) => stock.category === "ARCHIVE").length,
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
  let body: { replace?: boolean; vaultPath?: string } = {};
  try {
    body = (await request.json()) as { replace?: boolean; vaultPath?: string };
  } catch {
    body = {};
  }

  const vaultRoot = resolveVaultPath(body.vaultPath);
  if (!vaultRoot) {
    return NextResponse.json(
      { error: "未找到 Journal / investment-vault，请先填写 Vault 路径再导入。" },
      { status: 404 },
    );
  }

  try {
    invalidateArticleCache();
    const stocks = scanVaultStocks(vaultRoot);
    const articleImport = importVaultArticles(vaultRoot);
    const articleCounts = articleCountByStoredSymbol();

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
    return NextResponse.json({
      ok: true,
      vaultPath: vaultRoot,
      imported: stocks.length,
      articles: articleImport.articleCount,
      assets: countStoreAssets(),
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
