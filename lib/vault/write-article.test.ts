import assert from "node:assert/strict";
import test from "node:test";
import {
  quoteYaml,
  replaceFrontmatterScalar,
  replaceMarkdownBody,
} from "./write-article";

const sample = `---
schema_version: 1
type: article
title: "中海油"
source: "财新"
published_at: "2024-11-25"
---

旧正文
第二段
`;

test("replaceMarkdownBody keeps frontmatter and rewrites the body", () => {
  const next = replaceMarkdownBody(sample, "新正文\n\n![[img.png]]");
  assert.match(next, /^---\n[\s\S]*title: "中海油"\n[\s\S]*---\n\n/);
  assert.match(next, /新正文\n\n!\[\[img\.png\]\]\n$/);
  assert.doesNotMatch(next, /旧正文/);
});

test("replaceMarkdownBody works without frontmatter", () => {
  assert.equal(replaceMarkdownBody("hello\n", "world"), "world\n");
});

test("replaceFrontmatterScalar updates an existing source", () => {
  const next = replaceFrontmatterScalar(sample, "source", "我的想法");
  assert.match(next, /^source: "我的想法"$/m);
  assert.match(next, /旧正文/);
});

test("replaceFrontmatterScalar inserts source when missing", () => {
  const withoutSource = sample.replace(/^source: "财新"\n/m, "");
  const next = replaceFrontmatterScalar(withoutSource, "source", "我的想法");
  assert.match(next, /^source: "我的想法"$/m);
});

test("quoteYaml escapes quotes", () => {
  assert.equal(quoteYaml('说"话"'), '"说\\"话\\""');
});
