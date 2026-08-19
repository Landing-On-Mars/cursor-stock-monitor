import { createHash } from "node:crypto";
import { quoteYaml } from "./write-article";
import { findSection, splitSections } from "./markdown";

export type VaultFocusNote = {
  id: string;
  notedAt: string;
  body: string;
};

const DATE_HEADING = /^###\s+(\d{4}-\d{2}-\d{2})\s*$/;
const OBSERVATION_HEADING = "观察";

export function focusNoteId(notedAt: string, body: string) {
  return createHash("sha1").update(`${notedAt}\n${body}`).digest("hex").slice(0, 16);
}

export function emptyJournalMarkdown(symbol: string, name: string) {
  const title = name.trim() || symbol.trim() || "日志";
  return `---
schema_version: 1
type: stock-journal
symbol: ${quoteYaml(symbol)}
name: ${quoteYaml(title)}
---

# ${title} · 日志
`;
}

export function parseFocusNotes(markdown: string): VaultFocusNote[] {
  const legacy = splitLegacyObservation(markdown);
  if (legacy.found) return legacy.notes;
  return splitJournal(markdown).notes;
}

export function appendFocusNote(markdown: string, notedAt: string, body: string) {
  const date = notedAt.trim();
  const text = body.replace(/\r\n/g, "\n").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !text) {
    throw new Error("请填写日期和内容。");
  }

  const current = splitJournal(markdown);
  const nextNotes = [{ id: focusNoteId(date, text), notedAt: date, body: text }, ...current.notes];
  return renderJournal(current.header, current.preamble, nextNotes);
}

export function updateFocusNote(markdown: string, id: string, notedAt: string, body: string) {
  const date = notedAt.trim();
  const text = body.replace(/\r\n/g, "\n").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !text) {
    throw new Error("请填写日期和内容。");
  }

  const current = splitJournal(markdown);
  let found = false;
  const nextNotes = current.notes.map((note) => {
    if (note.id !== id) return note;
    found = true;
    return { id: focusNoteId(date, text), notedAt: date, body: text };
  });
  if (!found) throw new Error("没有找到这条记录。");
  return renderJournal(current.header, current.preamble, nextNotes);
}

export function removeFocusNote(markdown: string, id: string) {
  const current = splitJournal(markdown);
  const nextNotes = current.notes.filter((note) => note.id !== id);
  if (nextNotes.length === current.notes.length) {
    throw new Error("没有找到这条记录。");
  }
  return renderJournal(current.header, current.preamble, nextNotes);
}

export function parseLegacyObservationNotes(markdown: string) {
  return splitLegacyObservation(markdown).notes;
}

export function stripObservationSection(markdown: string) {
  const current = splitLegacyObservation(markdown);
  if (!current.found) return markdown.replace(/\r\n/g, "\n");
  return replaceObservationSection(markdown, "", []);
}

function splitJournal(markdown: string) {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const headerEnd = headerBoundary(normalized);
  const header = headerEnd >= 0 ? normalized.slice(0, headerEnd).trimEnd() : "";
  const body = headerEnd >= 0 ? normalized.slice(headerEnd) : normalized;
  return { header, ...splitDatedBlocks(body) };
}

function splitLegacyObservation(markdown: string) {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const section = findSection(splitSections(normalized), new RegExp(`^${OBSERVATION_HEADING}$`));
  if (!section) return { found: false, preamble: "", notes: [] as VaultFocusNote[] };
  return { found: true, ...splitDatedBlocks(section.content) };
}

function splitDatedBlocks(content: string) {
  const chunks = content.split(/^(?=###\s+\d{4}-\d{2}-\d{2}\s*$)/m);
  let preamble = "";
  const notes: VaultFocusNote[] = [];

  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    const lines = trimmed.split("\n");
    const match = lines[0]?.match(DATE_HEADING);
    if (!match) {
      preamble = preamble ? `${preamble}\n\n${trimmed}` : trimmed;
      continue;
    }
    const notedAt = match[1];
    const body = lines.slice(1).join("\n").trim();
    notes.push({
      id: focusNoteId(notedAt, body),
      notedAt,
      body,
    });
  }

  return { preamble, notes };
}

function renderJournal(header: string, preamble: string, notes: VaultFocusNote[]) {
  const parts: string[] = [];
  if (preamble.trim()) parts.push(preamble.trim());
  for (const note of notes) {
    parts.push(`### ${note.notedAt}\n\n${note.body}`);
  }
  const inner = parts.join("\n\n");
  const body = inner ? `${inner}\n` : "";
  if (!header.trim()) return body;
  return `${header.trim()}\n\n${body}`.replace(/\n{3,}/g, "\n\n").replace(/\n*$/, "\n");
}

function headerBoundary(markdown: string) {
  if (!markdown.startsWith("---")) return -1;
  const end = markdown.indexOf("\n---", 3);
  if (end < 0) return -1;
  return end + 4;
}

function replaceObservationSection(
  markdown: string,
  preamble: string,
  notes: VaultFocusNote[],
) {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const innerParts: string[] = [];
  if (preamble.trim()) innerParts.push(preamble.trim());
  for (const note of notes) {
    innerParts.push(`### ${note.notedAt}\n\n${note.body}`);
  }
  const inner = innerParts.join("\n\n");
  const block = inner ? `## ${OBSERVATION_HEADING}\n\n${inner}\n` : "";

  if (/^## 观察[ \t]*$/m.test(normalized)) {
    const following = /^## 观察[ \t]*\n[\s\S]*?(?=^## )/m;
    const replaced = following.test(normalized)
      ? normalized.replace(following, block ? `${block}\n` : "")
      : normalized.replace(/^## 观察[ \t]*\n[\s\S]*$/m, block.trimEnd());
    return replaced.replace(/\n{3,}/g, "\n\n").replace(/\n*$/, "\n");
  }

  return normalized;
}
