import assert from "node:assert/strict";
import test from "node:test";
import { isVaultArticlePath } from "./article-path";

test("accepts vault article paths and rejects traversal", () => {
  assert.equal(isVaultArticlePath("Articles/0883 20241125：中海油没人要了吗？.md"), true);
  assert.equal(isVaultArticlePath("Articles\\0883 note.md"), true);
  assert.equal(isVaultArticlePath("Stocks/HK/0883.HK - 中海油.md"), false);
  assert.equal(isVaultArticlePath("Articles/../Stocks/secret.md"), false);
  assert.equal(isVaultArticlePath("Articles/note.txt"), false);
});
