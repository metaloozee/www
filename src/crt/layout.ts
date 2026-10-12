import type { ContributionGrid } from "@/lib/github-contributions";
import {
  type Block,
  collectLinks,
  type OpenRoles,
  type ScreenDoc,
  type Span,
} from "./doc";

export type Tone = "ghost" | "faint" | "dim" | "phosphor" | "hot";

export interface Run {
  big?: boolean;
  col: number;
  link?: number;
  text: string;
  tone: Tone;
}

export interface GraphLine {
  grid: ContributionGrid;
  // Weeks cut from the left so the graph fits the measure.
  offset: number;
}

export interface FigureLine {
  alt: string;
  // The full-size picture, shown in full screen. Clips have none.
  full?: string;
  // Picture size on the grid, in font pixels: as wide as the measure allows.
  height: number;
  // Position of the figure's link in the link order.
  link?: number;
  src: string;
  // A clip plays here; a row of transport controls sits under the picture.
  video: boolean;
  width: number;
}

const pictureRows = (figure: FigureLine) =>
  Math.ceil(figure.height / CELL_PX_H);

export const figureBySrc = (layout: ScreenLayout, src: string) =>
  layout.lines.find((line) => line.figure?.src === src)?.figure;

// A big line holds 2x glyphs and takes two text rows; a graph line holds
// the contribution squares, two days to a row; a figure line holds a
// picture and takes as many rows as it needs.
export interface Line {
  big: boolean;
  figure?: FigureLine;
  graph?: GraphLine;
  runs: Run[];
}

export interface ScreenLink {
  // Set on a figure's link, to the figure's src. The link has no text on
  // the screen: the picture and its controls stand for it.
  figure?: string;
  href: string;
  label: string;
  row: number;
  // Set on a role title: activating it opens or closes that block.
  toggle?: { block: number; open: boolean };
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
const BULLET = "- ";
// The VGA font is CP437, which has no en dash.
const screenCase = (value: string) => value.toUpperCase().replaceAll("–", "-");
const WORD = /(?<= )/;

// Each day is 8x8 font pixels, half a cell: a week of seven fills 3.5 rows.
export const DAY_PX = 8;
export const DAYS_PER_ROW = 2;
const GRAPH_ROWS = 4;
// Font pixels per cell, as in draw.ts, which imports from here.
const CELL_PX_W = 8;
const CELL_PX_H = 16;
const LEGEND: Tone[] = ["ghost", "faint", "dim", "phosphor", "hot"];

export const lineRows = (line: Line) => {
  if (line.figure) {
    return pictureRows(line.figure) + (line.figure.video ? 1 : 0);
  }
  if (line.graph) {
    return GRAPH_ROWS;
  }
  return line.big ? 2 : 1;
};

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

const text = (runs: Run[]): Line => ({ big: false, runs });

function layoutContributions(
  block: Extract<Block, { kind: "contributions" }>,
  width: number,
  ids: LinkIds
): Line[] {
  const { grid, link } = block;
  if (grid.days.length === 0) {
    return [
      text([
        {
          col: 0,
          text: "ERROR: contribution data unavailable.",
          tone: "faint",
        },
      ]),
    ];
  }
  const offset = Math.max(0, grid.weeks - width);
  const months = grid.months
    .filter((month) => month.week >= offset)
    .map(
      (month): Run => ({
        col: month.week - offset,
        text: month.label,
        tone: "faint",
      })
    );

  const summary = `${grid.total.toLocaleString("en")} contributions in the last year on `;
  const footer = wrap([{ text: summary }, link], width, 0, "dim", ids);
  // The legend shares the summary's row, so it goes when that row wraps.
  const row = footer.length === 1 ? footer[0] : undefined;
  const legendWidth = "LESS ".length + LEGEND.length + " MORE".length;
  let col = width - legendWidth;
  if (row && col >= summary.length + link.text.length + 2) {
    row.runs.push({ col, text: "LESS ", tone: "faint" });
    col += "LESS ".length;
    for (const tone of LEGEND) {
      row.runs.push({ col, text: "■", tone });
      col += 1;
    }
    row.runs.push({ col, text: " MORE", tone: "faint" });
  }

  return [
    text(months),
    { big: false, graph: { grid, offset }, runs: [] },
    text([]),
    ...footer,
  ];
}

function layoutRole(
  block: Extract<Block, { kind: "role" }>,
  width: number,
  ids: LinkIds,
  open: boolean
): Line[] {
  const indent = ENTRY_INDEX_WIDTH;
  const marker = open ? "[-] " : "[+] ";
  const title: Span = { ...block.title, text: screenCase(block.title.text) };
  const link = ids.get(block.title);
  const lines = wrap(
    [title],
    width,
    indent,
    "phosphor",
    new Map([[title, link ?? 0]]),
    [{ col: 0, link, text: marker, tone: "phosphor" }]
  );

  // Dates sit right of a one-line title; on narrow glass they lead the
  // place line instead.
  const dates = screenCase(block.dates);
  const place = screenCase(block.place);
  const first = lines.at(0);
  const head = first?.runs.at(-1);
  const fits =
    lines.length === 1 &&
    head !== undefined &&
    head.col + head.text.length + 2 + dates.length <= width;
  if (fits) {
    first?.runs.push({
      col: width - dates.length,
      text: dates,
      tone: "faint",
    });
  }
  const meta = fits ? place : `${dates} · ${place}`;
  lines.push(...wrap([{ text: meta }], width, indent, "faint", ids));
  if (!open) {
    return lines;
  }

  if (block.lead) {
    lines.push(...wrap(block.lead, width, indent, "dim", ids));
  }
  for (const bullet of block.bullets) {
    lines.push(
      ...wrap([{ text: bullet }], width, indent + BULLET.length, "dim", ids, [
        { col: indent, text: BULLET, tone: "faint" },
      ])
    );
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
    case "contributions":
      return layoutContributions(block, width, ids);
    case "list":
      return block.items.flatMap((item) =>
        wrap([{ text: item }], width, BULLET.length, "dim", ids, [
          { col: 0, text: BULLET, tone: "faint" },
        ])
      );
    case "figure": {
      const figureWidth = Math.min(block.width, width * CELL_PX_W);
      const figure: FigureLine = {
        alt: block.alt,
        full: block.video ? undefined : block.link.href,
        height: Math.round((figureWidth * block.height) / block.width),
        link: ids.get(block.link),
        src: block.src,
        video: block.video !== undefined,
        width: figureWidth,
      };
      const picture: Line = { big: false, figure, runs: [] };
      // A clip is captioned by its own controls; a picture gets a line.
      return block.video
        ? [picture]
        : [picture, ...wrap([{ text: block.caption }], width, 0, "faint", ids)];
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

// Blank rows before a block: two before each new command and either side
// of a section rule, one between blocks otherwise.
const SECTION_GAP = 2;
function gapBefore(previous: Block | undefined, block: Block) {
  if (!previous) {
    return 0;
  }
  const breaks =
    previous.kind === "rule" ||
    block.kind === "rule" ||
    block.kind === "prompt";
  return breaks ? SECTION_GAP : 1;
}

const NONE_OPEN: OpenRoles = new Set();

export function layoutDoc(
  doc: ScreenDoc,
  width: number,
  open: OpenRoles = NONE_OPEN
): ScreenLayout {
  const linkSpans = collectLinks(doc);
  const ids: LinkIds = new Map(linkSpans.map((span, i) => [span, i]));

  const lines: Line[] = [];
  const blockStart: number[] = [];
  let previous: Block | undefined;
  const toggles = new Map<Span, { block: number; open: boolean }>();
  const figures = new Map<Span, string>();
  for (const [i, block] of doc.blocks.entries()) {
    for (let gap = gapBefore(previous, block); gap > 0; gap -= 1) {
      lines.push({ big: false, runs: [] });
    }
    blockStart.push(lines.length);
    if (block.kind === "role") {
      toggles.set(block.title, { block: i, open: open.has(i) });
      lines.push(...layoutRole(block, width, ids, open.has(i)));
    } else {
      if (block.kind === "figure") {
        figures.set(block.link, block.src);
      }
      lines.push(...layoutBlock(block, width, ids));
    }
    previous = block;
  }

  const rowOf: number[] = [];
  let row = 0;
  for (const line of lines) {
    rowOf.push(row);
    row += lineRows(line);
  }

  const links: ScreenLink[] = linkSpans.map((span, id) => {
    const lineIndex = lines.findIndex(
      (line) =>
        line.figure?.link === id || line.runs.some((run) => run.link === id)
    );
    return {
      figure: figures.get(span),
      href: span.href ?? "",
      label: span.text,
      row: rowOf[lineIndex] ?? 0,
      toggle: toggles.get(span),
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
    return row >= top && row < top + lineRows(line);
  });
  const run = layout.lines[index]?.runs.find(
    (r) => r.link !== undefined && col >= r.col && col < r.col + runWidth(r)
  );
  return run?.link;
}

// A clip's control row, in columns from the picture's left edge: the play
// glyph, the progress bar, the clock, and the full-screen switch.
export type TransportPart = "play" | "seek" | "full";
const TRANSPORT_GLYPH_COLS = 3;
const TRANSPORT_CLOCK_COLS = 11;
const TRANSPORT_FULL_COLS = 6;
export function transportCols(cols: number) {
  const full = cols - TRANSPORT_FULL_COLS;
  const clock = full - 1 - TRANSPORT_CLOCK_COLS;
  const start = TRANSPORT_GLYPH_COLS;
  return { bar: { end: Math.max(start + 1, clock - 1), start }, clock, full };
}

// `seek` is the fraction of the clip a progress bar column stands for.
export function transportAt(
  cols: number,
  col: number
): { part: TransportPart; seek?: number } | undefined {
  const { bar, full } = transportCols(cols);
  if (col < bar.start) {
    return { part: "play" };
  }
  if (col >= full) {
    return { part: "full" };
  }
  if (col < bar.end) {
    return {
      part: "seek",
      seek: (col - bar.start + 0.5) / (bar.end - bar.start),
    };
  }
}

export interface FigureHit {
  figure: FigureLine;
  part: "picture" | TransportPart;
  seek?: number;
}

// Figure under a document row/column.
export function figureAt(
  layout: ScreenLayout,
  row: number,
  col: number
): FigureHit | undefined {
  for (const [i, line] of layout.lines.entries()) {
    const { figure } = line;
    const top = layout.rowOf[i] ?? 0;
    if (!figure || row < top || row >= top + lineRows(line)) {
      continue;
    }
    const cols = Math.floor(figure.width / CELL_PX_W);
    if (col < 0 || col >= cols) {
      return;
    }
    if (row < top + pictureRows(figure)) {
      return { figure, part: "picture" };
    }
    const control = transportAt(cols, col);
    return control && { figure, ...control };
  }
}

// Day under a document font-pixel position: `y` counts font pixels from
// the top of the document, `col` is a cell column inside the measure.
export function dayAt(
  layout: ScreenLayout,
  y: number,
  col: number
): { graph: GraphLine; index: number } | undefined {
  for (const [i, line] of layout.lines.entries()) {
    const { graph } = line;
    if (!graph) {
      continue;
    }
    const top = (layout.rowOf[i] ?? 0) * DAY_PX * DAYS_PER_ROW;
    const weekday = Math.floor((y - top) / DAY_PX);
    const week = col + graph.offset;
    const index = graph.grid.days.findIndex(
      (day) => day.week === week && day.weekday === weekday
    );
    return index === -1 ? undefined : { graph, index };
  }
}
