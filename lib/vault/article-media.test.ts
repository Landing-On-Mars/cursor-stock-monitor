import assert from "node:assert/strict";
import test from "node:test";
import {
  articleAssetCandidates,
  isVaultArticleAssetPath,
  splitArticleBody,
} from "./article-media";

test("resolves short wiki embeds under Articles/attachments", () => {
  const article = "Articles/0883 20241125：中海油没人要了吗？.md";
  const candidates = articleAssetCandidates(article, "0883 20241125/img_2.png");
  assert.ok(candidates.includes("Articles/attachments/0883 20241125/img_2.png"));
  assert.ok(candidates.includes("Articles/0883 20241125/img_2.png"));
  const sized = articleAssetCandidates(article, "0883 20241125/img_2.png|640");
  assert.ok(sized.includes("Articles/attachments/0883 20241125/img_2.png"));
});

test("keeps vault-relative attachment paths", () => {
  const candidates = articleAssetCandidates(
    "Articles/002271 20240424：防水的烂生意，龙头的脏财报.md",
    "Articles/attachments/002271 20240424防水/img_01.png",
  );
  assert.ok(candidates.includes("Articles/attachments/002271 20240424防水/img_01.png"));
});

test("rejects path traversal and non-images", () => {
  assert.equal(isVaultArticleAssetPath("Articles/attachments/foo/img.png"), true);
  assert.equal(isVaultArticleAssetPath("Articles/../Stocks/secret.png"), false);
  assert.equal(isVaultArticleAssetPath("Articles/note.md"), false);
  assert.deepEqual(articleAssetCandidates("Articles/a.md", "../secret.png"), []);
});

test("splits wiki and markdown images out of the article body", () => {
  const blocks = splitArticleBody(
    "前言\n\n![[0883 20241125/img_2.png]]\n\n后记 ![图](https://example.com/a.png)",
  );
  assert.equal(blocks[0]?.type, "text");
  assert.equal(blocks[1]?.type, "image");
  if (blocks[1]?.type === "image") {
    assert.equal(blocks[1].src, "0883 20241125/img_2.png");
    assert.equal(blocks[1].remote, false);
  }
  assert.equal(blocks[3]?.type, "image");
  if (blocks[3]?.type === "image") {
    assert.equal(blocks[3].remote, true);
  }
});
