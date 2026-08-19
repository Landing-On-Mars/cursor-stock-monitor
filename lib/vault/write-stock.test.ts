import assert from "node:assert/strict";
import test from "node:test";
import { replaceThesis } from "./write-stock";

const sample = `---
symbol: "1866.HK"
---

# 中国心连心化肥

## Investment thesis

旧观点。

**核心逻辑**：
1. 成本

## Timeline

- 2025-03：笔记
`;

test("replaceThesis rewrites Investment thesis and keeps the next section", () => {
  const next = replaceThesis(sample, "新观点。\n\n- **现价**：9.5");
  assert.match(next, /## Investment thesis\n\n新观点。\n\n- \*\*现价\*\*：9.5\n\n## Timeline/);
  assert.doesNotMatch(next, /旧观点/);
});

test("replaceThesis inserts 核心投资逻辑 before 观察 when missing", () => {
  const source = `---
symbol: "0700.HK"
---

# 腾讯

## 观察

### 2026-08-19

先看广告。
`;
  const next = replaceThesis(source, "微信还在。");
  assert.match(next, /## 核心投资逻辑\n\n微信还在。\n\n## 观察/);
});
