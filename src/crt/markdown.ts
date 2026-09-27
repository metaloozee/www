import type { Block, ScreenDoc, Span } from "./doc";

const WIDTH = 72;
const SPACES = /\s+/;

export const FONT_CREDIT =
  "Screen font: Px437 IBM VGA 8x16, Ultimate Oldschool PC Font Pack (int10h.org), CC BY-SA 4.0.";

const inline = (spans: Span[]) =>
  spans
    .map((span) => (span.href ? `[${span.text}](${span.href})` : span.text))
    .join("");

// Hard-wraps on spaces so the source reads well raw. Words longer than the
// line, such as URLs, overflow rather than break.
function wrap(text: string, first: string, rest = first) {
  const lines: string[] = [];
  let line = first;
  let empty = true;
  for (const word of text.split(SPACES)) {
    if (!(empty || line.length + 1 + word.length <= WIDTH)) {
      lines.push(line);
      line = rest;
      empty = true;
    }
    line += empty ? word : ` ${word}`;
    empty = false;
  }
  lines.push(line);
  return lines.join("\n");
}

const sentenceCase = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();

function blockMarkdown(block: Block): string | undefined {
  switch (block.kind) {
    case "heading":
      return `## ${sentenceCase(block.section ?? block.text)}`;
    case "paragraph":
      return wrap(inline(block.spans), "");
    case "facts":
      return block.rows
        .map((row) => wrap(`${row.label}: ${inline(row.value)}`, "- ", "  "))
        .join("\n");
    case "entry":
      return wrap(`${inline([block.title])}: ${block.body}`, "- ", "  ");
    case "contributions": {
      const { grid, link } = block;
      if (grid.days.length === 0) {
        return;
      }
      const total = grid.total.toLocaleString("en-US");
      return wrap(
        `${total} contributions in the last year on [GitHub](${link.href}).`,
        ""
      );
    }
    default:
      // Prompts and rules are CRT dressing.
      return;
  }
}

// The agent-mode rendering of the same document the CRT draws: served at
// /index.md and /llms.txt and shown raw in agent mode.
export function toMarkdown(doc: ScreenDoc) {
  const parts = [`# ${doc.name}`, wrap(doc.summary, "> ")];
  let previous: Block | undefined;
  for (const block of doc.blocks) {
    const part = blockMarkdown(block);
    // Consecutive entries form one tight list.
    if (part && block.kind === "entry" && previous?.kind === "entry") {
      parts[parts.length - 1] += `\n${part}`;
    } else if (part) {
      parts.push(part);
    }
    previous = block;
  }
  parts.push(`---\n${wrap(FONT_CREDIT, "")}`);
  return `${parts.join("\n\n")}\n`;
}
