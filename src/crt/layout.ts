import { type Block, collectLinks, type ScreenDoc, type Span } from "./doc";

export type Tone = "ghost" | "faint" | "dim" | "phosphor" | "hot";

export interface Run {
  big?: boolean;
  col: number;
  link?: number;
  text: string;
  tone: Tone;
}

// A big line holds 2x glyphs and takes two text rows.
export interface Line {
  big: boolean;
  runs: Run[];
}

export interface ScreenLink {
  href: string;
  label: string;
  row: number;
}

export interface Section {
  label: string;
  // Row the section starts on: its prompt line when one leads the heading.
  row: number;
}

export interface ScreenLayout {
  lines: Line[];
  links: ScreenLink[];
  // First text row of each line.
  rowOf: number[];
  sections: Section[];
  totalRows: number;
}

const FACT_LABEL_WIDTH = 12;
const ENTRY_INDEX_WIDTH = 4;
const WORD = /(?<= )/;

type LinkIds = Map<Span, number>;

function appendRun(runs: Run[], run: Run) {
  const last = runs.at(-1);
  if (
    last &&
    last.tone === run.tone &&
    last.link === run.link &&
    last.col + last.text.length === run.col
  ) {
    last.text += run.text;
    return;
  }
  runs.push(run);
}

function wrap(
  spans: Span[],
  width: number,
  indent: number,
  tone: Tone,
  ids: LinkIds,
  firstRuns: Run[] = []
): Line[] {
  const lines: Line[] = [];
  let runs = firstRuns;
  let col = indent;
  const breakLine = () => {
    lines.push({ big: false, runs });
    runs = [];
    col = indent;
  };

  for (const span of spans) {
    const link = ids.get(span);
    const spanTone: Tone = link === undefined ? tone : "phosphor";
    for (const word of span.text.split(WORD)) {
      if (col + word.trimEnd().length > width && col > indent) {
        breakLine();
      }
      if (col === indent && word.trim() === "") {
        continue;
      }
      appendRun(runs, { col, link, text: word, tone: spanTone });
      col += word.length;
    }
  }
  if (runs.length > 0) {
    breakLine();
  }
  return lines;
}

function layoutBlock(block: Block, width: number, ids: LinkIds): Line[] {
  switch (block.kind) {
    case "prompt":
      return [
        { big: false, runs: [{ col: 0, text: block.text, tone: "faint" }] },
      ];
    case "heading":
      return [
        {
          big: true,
          runs: [{ big: true, col: 0, text: block.text, tone: "phosphor" }],
        },
      ];
    case "paragraph":
      return wrap(block.spans, width, 0, "dim", ids);
    case "facts":
      return block.rows.flatMap((row) =>
        wrap(row.value, width, FACT_LABEL_WIDTH, "dim", ids, [
          { col: 0, text: row.label, tone: "faint" },
        ])
      );
    case "entry": {
      const title = `${block.title.text} →`;
      const head: Run[] = [
        { col: 0, text: block.index, tone: "faint" },
        {
          col: ENTRY_INDEX_WIDTH,
          link: ids.get(block.title),
          text: title,
          tone: "phosphor",
        },
        { col: width - block.meta.length, text: block.meta, tone: "faint" },
      ];
      return [
        { big: false, runs: head },
        ...wrap([{ text: block.body }], width, ENTRY_INDEX_WIDTH, "dim", ids),
      ];
    }
    case "rule":
      return [
        {
          big: false,
          runs: [{ col: 0, text: "─".repeat(width), tone: "faint" }],
        },
      ];
    default:
      return [];
  }
}

// Blank rows before a block: two either side of a section rule, one
// between blocks inside a section.
const SECTION_GAP = 2;
function gapBefore(previous: Block | undefined, block: Block) {
  if (!previous) {
    return 0;
  }
  return previous.kind === "rule" || block.kind === "rule" ? SECTION_GAP : 1;
}

export function layoutDoc(doc: ScreenDoc, width: number): ScreenLayout {
  const linkSpans = collectLinks(doc);
  const ids: LinkIds = new Map(linkSpans.map((span, i) => [span, i]));

  const lines: Line[] = [];
  const blockStart: number[] = [];
  let previous: Block | undefined;
  for (const block of doc.blocks) {
    for (let gap = gapBefore(previous, block); gap > 0; gap -= 1) {
      lines.push({ big: false, runs: [] });
    }
    blockStart.push(lines.length);
    lines.push(...layoutBlock(block, width, ids));
    previous = block;
  }

  const rowOf: number[] = [];
  let row = 0;
  for (const line of lines) {
    rowOf.push(row);
    row += line.big ? 2 : 1;
  }

  const links: ScreenLink[] = linkSpans.map((span, id) => {
    const lineIndex = lines.findIndex((line) =>
      line.runs.some((run) => run.link === id)
    );
    return {
      href: span.href ?? "",
      label: span.text,
      row: rowOf[lineIndex] ?? 0,
    };
  });

  const sections: Section[] = [];
  for (const [i, block] of doc.blocks.entries()) {
    if (block.kind !== "heading" || !block.section) {
      continue;
    }
    const lead = doc.blocks[i - 1]?.kind === "prompt" ? i - 1 : i;
    sections.push({
      label: block.section,
      row: rowOf[blockStart[lead] ?? 0] ?? 0,
    });
  }

  return { lines, links, rowOf, sections, totalRows: row };
}

export const runWidth = (run: Run) =>
  (run.link === undefined ? run.text : run.text.trimEnd()).length *
  (run.big ? 2 : 1);

// Link under a text row/column of the document (not the screen).
export function linkAtCell(
  layout: ScreenLayout,
  row: number,
  col: number
): number | undefined {
  const index = layout.lines.findIndex((line, i) => {
    const top = layout.rowOf[i] ?? 0;
    return row >= top && row < top + (line.big ? 2 : 1);
  });
  const run = layout.lines[index]?.runs.find(
    (r) => r.link !== undefined && col >= r.col && col < r.col + runWidth(r)
  );
  return run?.link;
}
