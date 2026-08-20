import assert from "node:assert/strict";
import test from "node:test";
import { parseStockMarkdown, statusKind } from "./parse-stock";

const fixture = `---
symbol: "3993.HK"
name: "洛阳钼业"
market: HK
tier: watch
industries:
  - "铜钴矿业"
tags:
  - "铜"
updated_at: "2026-08-11"
next_earnings: ""
---
## Investment thesis

_全球前十大铜生产商。关键变量：铜价与刚果产能。_

**Key metrics to watch:**
- 铜产量
- 钴销量

**风险：**
- 刚果政策
- 钴出口配额

## 预期跟踪 (Expectation Tracker)

| # | 预期（具体、可验证） | 验证时点 | 状态 | 验证记录 / 实际结果 |
|---|---|---|---|---|
| 1 | 2025Q2 钴单季毛利~30亿 | 2025H1/年报 | ✅ | 盈利强于预期 |
| 2 | 内部市值目标3000亿 | 2030 | 🔲 | 远期目标 |

## 催化剂进展 (Catalysts)

| 催化剂 | 最新进展 | 状态 |
| --- | --- | --- |
| KFM二期 | 土建约80% | 🟡 进行中 |

## Timeline

| Date | Type | Event |
| --- | --- | --- |
| 2026-06-05 | #news | 黄仁勋背书 |
| 2025-03-20 | #earnings | 年报超预期 |

## 估值记录

| 日期 | 股价 | 估值方法 | 核心假设 | 合理价值 | 结论 |
|---|---|---|---|---|---|
| 2026-08-19 | HK$10 | 2027E PE | 铜价中枢 | 8x | 不便宜 |
`;

test("parses thesis, expectations and timeline from mixed Chinese/English notes", () => {
  const stock = parseStockMarkdown("Stocks/HK/3993.HK - 洛阳钼业.md", fixture);
  assert.equal(stock.name, "洛阳钼业");
  assert.match(stock.summary, /全球前十大铜生产商/);
  assert.deepEqual(stock.metrics, ["铜产量", "钴销量"]);
  assert.equal(stock.expectations.length, 2);
  assert.equal(stock.expectations[0].statusKind, "met");
  assert.equal(stock.expectations[1].statusKind, "pending");
  assert.equal(stock.catalysts[0].statusKind, "drift");
  assert.equal(stock.timeline[0].type, "news");
  assert.equal(stock.valuations.length, 1);
  assert.equal(stock.valuations[0].method, "2027E PE");
  assert.equal(stock.valuations[0].value, "8x");
  assert.equal(statusKind("❌ 落空"), "miss");
});
