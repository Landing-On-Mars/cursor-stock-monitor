import { findSection, splitSections } from "./markdown";

export const THESIS_HEADING = /investment thesis|核心投资逻辑/i;

export function replaceThesis(markdown: string, content: string) {
  const text = content.replace(/\r\n/g, "\n").trim();
  if (!text) throw new Error("请填写投资逻辑。");

  const normalized = markdown.replace(/\r\n/g, "\n");
  const current = findSection(splitSections(normalized), THESIS_HEADING);
  const heading = current?.heading || "核心投资逻辑";
  const block = `## ${heading}\n\n${text}\n`;
  const headingLine = new RegExp(`^## ${escapeRegExp(heading)}[ \\t]*$`, "m");

  if (headingLine.test(normalized)) {
    const following = new RegExp(
      `^## ${escapeRegExp(heading)}[ \\t]*\\n[\\s\\S]*?(?=^## )`,
      "m",
    );
    const replaced = following.test(normalized)
      ? normalized.replace(following, `${block}\n`)
      : normalized.replace(
          new RegExp(`^## ${escapeRegExp(heading)}[ \\t]*\\n[\\s\\S]*$`, "m"),
          block.trimEnd(),
        );
    return tidy(replaced);
  }

  const before = normalized.search(/^## (观察|Related(\s+Articles)?)[ \t]*$/m);
  if (before >= 0) {
    return tidy(
      `${normalized.slice(0, before).replace(/\s*$/, "\n\n")}${block}\n${normalized.slice(before)}`,
    );
  }
  return tidy(`${normalized.replace(/\s*$/, "\n\n")}${block}`);
}

function tidy(value: string) {
  return value.replace(/\n{3,}/g, "\n\n").replace(/\n*$/, "\n");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
