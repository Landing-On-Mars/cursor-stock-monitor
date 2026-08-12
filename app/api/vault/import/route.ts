import { NextResponse } from "next/server";
import { db } from "@/lib/db";
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
  const status = vaultStatus();
  if (!status.resolved) {
    return NextResponse.json({
      ...status,
      stockCount: 0,
      articleCount: 0,
      watchlistCount: listWatchlistItems().length,
    });
  }

  try {
    const stocks = scanVaultStocks(status.resolved);
    const articles = scanVaultArticles(status.resolved);
    const articleCounts = articleCountBySymbol(status.resolved);
    return NextResponse.json({
      ...status,
      stockCount: stocks.length,
      articleCount: articles.length,
      uniqueArticleSymbols: articleCounts.size,
      watchlistCount: listWatchlistItems().length,
      coreCount: stocks.filter((stock) => stock.category === "CORE").length,
      watchCount: stocks.filter((stock) => stock.category === "WATCH").length,
      archiveCount: stocks.filter((stock) => stock.category === "ARCHIVE").length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ...status,
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
      { error: "未找到可用的 investment-vault，请先在设置中配置 VAULT_PATH。" },
      { status: 404 },
    );
  }

  try {
    invalidateArticleCache();
    const stocks = scanVaultStocks(vaultRoot);
    const articleCounts = articleCountBySymbol(vaultRoot);

    const importStocks = db.transaction(() => {
      if (body.replace) {
        db.prepare("DELETE FROM watchlist_items").run();
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

      db.prepare(
        `INSERT INTO app_meta (key, value) VALUES ('vault_imported_at', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ).run(new Date().toISOString());
    });

    importStocks();

    const items = listWatchlistItems();
    return NextResponse.json({
      ok: true,
      vaultPath: vaultRoot,
      imported: stocks.length,
      core: items.filter((item) => item.category === "CORE").length,
      watch: items.filter((item) => item.category === "WATCH").length,
      archive: items.filter((item) => item.category === "ARCHIVE").length,
      items,
    });
  } catch (error) {
    console.error("Vault import failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Vault 导入失败。" },
      { status: 500 },
    );
  }
}
