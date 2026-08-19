import assert from "node:assert/strict";
import test from "node:test";
import { isStockJournalPath, stockJournalPath } from "./journal-path";

test("stockJournalPath sits next to the stock file", () => {
  assert.equal(
    stockJournalPath("Stocks/HK/1866.HK - 中国心连心化肥.md"),
    "Stocks/HK/1866.HK - 中国心连心化肥.日志.md",
  );
});

test("isStockJournalPath only matches the journal suffix under Stocks", () => {
  assert.equal(isStockJournalPath("Stocks/HK/1866.HK - 中国心连心化肥.日志.md"), true);
  assert.equal(isStockJournalPath("Stocks/HK/1866.HK - 中国心连心化肥.md"), false);
  assert.equal(isStockJournalPath("Articles/01866 笔记.md"), false);
});
