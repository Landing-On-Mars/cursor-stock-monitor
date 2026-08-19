import { createHash } from "node:crypto";
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

export function parseFocusNotes(markdown: string): VaultFocusNote[] {
  return splitObservation(markdown).notes;
}

export function appendFocusNote(markdown: string, notedAt: string, body: string) {
  const date = notedAt.trim();
  const text = body.replace(/\r\n/g, "\n").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !text) {
    throw new Error("请填写日期和内容。");
  }

  const current = splitObservation(markdown);
  const nextNotes = [{ id: focusNoteId(date, text), notedAt: date, body: text }, ...current.notes];
  return replaceObservationSection(markdown, current.preamble, nextNotes);
}

export function removeFocusNote(markdown: string, id: string) {
  const current = splitObservation(markdown);
  const nextNotes = current.notes.filter((note) => note.id !== id);
  if (nextNotes.length === current.notes.length) {
    throw new Error("没有找到这条记录。");
  }
  return replaceObservationSection(markdown, current.preamble, nextNotes);
}

function splitObservation(markdown: string) {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const section = findSection(splitSections(normalized), new RegExp(`^${OBSERVATION_HEADING}$`));
  if (!section) return { preamble: "", notes: [] as VaultFocusNote[] };

  const chunks = section.content.split(/^(?=###\s+\d{4}-\d{2}-\d{2}\s*$)/m);
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

function replaceObservationSection(
  markdown: string,
  preamble: string,
  notes: VaultFocusNote[],
) {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const inner = renderObservation(preamble, notes);
  const block = inner ? `## ${OBSERVATION_HEADING}\n\n${inner}\n` : "";

  if (/^## 观察[ \t]*$/m.test(normalized)) {
    const following = /^## 观察[ \t]*\n[\s\S]*?(?=^## )/m;
    const replaced = following.test(normalized)
      ? normalized.replace(following, block ? `${block}\n` : "")
      : normalized.replace(/^## 观察[ \t]*\n[\s\S]*$/m, block.trimEnd());
    return replaced.replace(/\n{3,}/g, "\n\n").replace(/\n*$/, "\n");
  }

  if (!block) return normalized;

  const related = normalized.search(/^## Related(\s+Articles)?[ \t]*$/m);
  if (related >= 0) {
    return `${normalized.slice(0, related).replace(/\s*$/, "\n\n")}${block}\n${normalized.slice(related)}`;
  }

  return `${normalized.replace(/\s*$/, "\n\n")}${block}`;
}

function renderObservation(preamble: string, notes: VaultFocusNote[]) {
  const parts: string[] = [];
  if (preamble.trim()) parts.push(preamble.trim());
  for (const note of notes) {
    parts.push(`### ${note.notedAt}\n\n${note.body}`);
  }
  return parts.join("\n\n");
}
