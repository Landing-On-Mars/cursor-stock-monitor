import assert from "node:assert/strict";
import test from "node:test";
import {
  appendFocusNote,
  emptyJournalMarkdown,
  parseFocusNotes,
  parseLegacyObservationNotes,
  removeFocusNote,
  stripObservationSection,
  updateFocusNote,
} from "./focus-notes";

const journal = `---
schema_version: 1
type: stock-journal
symbol: "2714.HK"
name: "牧原股份"
---

# 牧原股份 · 日志

### 2026-08-19

全年大约亏 110 亿。

### 2026-08-18

还在等猪价。
`;

const legacyStock = `---
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

test("parses dated blocks from a dedicated journal file", () => {
  const notes = parseFocusNotes(journal);
  assert.equal(notes.length, 2);
  assert.equal(notes[0].notedAt, "2026-08-19");
  assert.equal(notes[0].body, "全年大约亏 110 亿。");
  assert.equal(notes[1].notedAt, "2026-08-18");
});

test("still reads legacy ## 观察 on the stock page", () => {
  const notes = parseLegacyObservationNotes(legacyStock);
  assert.equal(notes.length, 2);
  assert.equal(notes[0].body, "全年大约亏 110 亿。");
});

test("appendFocusNote prepends in the journal file and keeps the title", () => {
  const next = appendFocusNote(journal, "2026-08-19", "仓位最多 3%。");
  const notes = parseFocusNotes(next);
  assert.equal(notes[0].body, "仓位最多 3%。");
  assert.equal(notes[1].body, "全年大约亏 110 亿。");
  assert.match(next, /# 牧原股份 · 日志/);
  assert.match(next, /type: stock-journal/);
  assert.doesNotMatch(next, /## 观察/);
});

test("updateFocusNote rewrites the matching entry in place", () => {
  const [first] = parseFocusNotes(journal);
  const next = updateFocusNote(journal, first.id, "2026-08-19", "观点：\n\n- **仓位**最多 3%。");
  const notes = parseFocusNotes(next);
  assert.equal(notes[0].body, "观点：\n\n- **仓位**最多 3%。");
  assert.equal(notes[1].body, "还在等猪价。");
});

test("removeFocusNote deletes only the matching entry", () => {
  const [keep] = parseFocusNotes(journal);
  const next = removeFocusNote(journal, keep.id);
  const notes = parseFocusNotes(next);
  assert.equal(notes.length, 1);
  assert.equal(notes[0].body, "还在等猪价。");
});

test("emptyJournalMarkdown can receive the first entry", () => {
  const source = emptyJournalMarkdown("0700.HK", "腾讯控股");
  const next = appendFocusNote(source, "2026-08-19", "先看广告。");
  assert.match(next, /# 腾讯控股 · 日志\n\n### 2026-08-19\n\n先看广告。/);
});

test("stripObservationSection removes 观察 from the stock page", () => {
  const next = stripObservationSection(legacyStock);
  assert.match(next, /规模加成本/);
  assert.match(next, /## Related Articles/);
  assert.doesNotMatch(next, /## 观察/);
  assert.doesNotMatch(next, /还在等猪价/);
});
