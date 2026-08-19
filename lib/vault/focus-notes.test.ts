import assert from "node:assert/strict";
import test from "node:test";
import { appendFocusNote, parseFocusNotes, removeFocusNote } from "./focus-notes";

const sample = `---
symbol: "2714.HK"
name: "牧原股份"
---

## 核心投资逻辑

规模加成本。

## 观察

### 2026-08-19

全年大约亏 110 亿。

### 2026-08-18

还在等猪价。

## Related Articles
`;

test("parses dated observation blocks newest first as written", () => {
  const notes = parseFocusNotes(sample);
  assert.equal(notes.length, 2);
  assert.equal(notes[0].notedAt, "2026-08-19");
  assert.equal(notes[0].body, "全年大约亏 110 亿。");
  assert.equal(notes[1].notedAt, "2026-08-18");
});

test("appendFocusNote puts the new entry at the top of 观察", () => {
  const next = appendFocusNote(sample, "2026-08-19", "仓位最多 3%。");
  const notes = parseFocusNotes(next);
  assert.equal(notes[0].body, "仓位最多 3%。");
  assert.equal(notes[1].body, "全年大约亏 110 亿。");
  assert.match(next, /## Related Articles/);
  assert.match(next, /规模加成本/);
});

test("removeFocusNote deletes only the matching entry", () => {
  const [keep] = parseFocusNotes(sample);
  const next = removeFocusNote(sample, keep.id);
  const notes = parseFocusNotes(next);
  assert.equal(notes.length, 1);
  assert.equal(notes[0].body, "还在等猪价。");
});

test("creates 观察 before Related Articles when missing", () => {
  const source = `---
symbol: "0700.HK"
---

## 核心投资逻辑

微信。

## Related Articles
`;
  const next = appendFocusNote(source, "2026-08-19", "先看广告。");
  assert.match(next, /## 观察\n\n### 2026-08-19\n\n先看广告。\n\n## Related Articles/);
});
