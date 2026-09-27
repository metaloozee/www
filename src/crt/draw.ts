import { type Run, runWidth, type ScreenLayout, type Tone } from "./layout";

export const CELL_W = 8;
export const CELL_H = 16;
export const FONT_FAMILY = "IBM VGA 8x16";

export type Palette = Record<Tone | "glass", string>;

export interface Grid {
  cols: number;
  // INDEX column on wide screens; absent when the grid is too narrow.
  index?: { col: number; width: number };
  margin: number;
  measure: number;
  rows: number;
}

export interface ScreenState {
  clock: string;
  cursorOn: boolean;
  focus?: number;
  hover?: number;
  hoverSection?: number;
  scroll: number;
  status?: string;
}

export interface Screen {
  ascent: number;
  grid: Grid;
  layout: ScreenLayout;
  palette: Palette;
  path: string;
  title: string;
}

const HINTS = "↑↓ SCROLL  TAB LINKS  ENTER OPEN";
const SHORT_HINTS = "↑↓ SCROLL";

// Row 0 is the title bar and the last row the status bar, each with a
// blank row of glass between it and the scrolling content.
export const CONTENT_TOP = 2;
export const viewportRows = (grid: Grid) => Math.max(1, grid.rows - 4);

export const INDEX_TOP = CONTENT_TOP + 2;

// Section the reader is in: the last one starting at or above the top
// visible row.
export function activeSection(screen: Screen, scroll: number) {
  let active = 0;
  for (const [i, section] of screen.layout.sections.entries()) {
    if (section.row <= scroll + 1) {
      active = i;
    }
  }
  return active;
}

export function sectionAt(screen: Screen, row: number, col: number) {
  const { index } = screen.grid;
  const i = row - INDEX_TOP;
  const inColumn = index && col >= index.col && col < index.col + index.width;
  return inColumn && i >= 0 && i < screen.layout.sections.length
    ? i
    : undefined;
}

export const maxScroll = (screen: Screen) =>
  Math.max(0, screen.layout.totalRows + 1 - viewportRows(screen.grid));

const setFont = (ctx: CanvasRenderingContext2D, size: number) => {
  ctx.font = `${CELL_H * size}px "${FONT_FAMILY}"`;
};

function textAt(
  ctx: CanvasRenderingContext2D,
  screen: Screen,
  text: string,
  col: number,
  row: number
) {
  ctx.fillText(text, col * CELL_W, row * CELL_H + screen.ascent);
}

function drawRun(
  ctx: CanvasRenderingContext2D,
  screen: Screen,
  state: ScreenState,
  run: Run,
  row: number
) {
  const size = run.big ? 2 : 1;
  const x = (screen.grid.margin + run.col) * CELL_W;
  const y = row * CELL_H;
  const w = runWidth(run) * CELL_W;
  const isLink = run.link !== undefined;
  const active =
    isLink && (run.link === state.hover || run.link === state.focus);

  setFont(ctx, size);
  if (active) {
    ctx.fillStyle = screen.palette.phosphor;
    ctx.fillRect(x, y, w, CELL_H * size);
  }
  ctx.fillStyle = active ? screen.palette.glass : screen.palette[run.tone];
  ctx.fillText(
    isLink ? run.text.trimEnd() : run.text,
    x,
    y + screen.ascent * size
  );
  if (isLink && !active) {
    ctx.fillRect(x, y + (CELL_H - 2) * size, w, size);
  }
}

function drawContent(
  ctx: CanvasRenderingContext2D,
  screen: Screen,
  state: ScreenState
) {
  const { grid, layout, palette } = screen;
  const visible = viewportRows(grid);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, CONTENT_TOP * CELL_H, grid.cols * CELL_W, visible * CELL_H);
  ctx.clip();

  for (const [i, line] of layout.lines.entries()) {
    const row = CONTENT_TOP + (layout.rowOf[i] ?? 0) - state.scroll;
    const bottom = CONTENT_TOP + visible;
    if (row + (line.big ? 2 : 1) <= CONTENT_TOP || row >= bottom) {
      continue;
    }
    for (const run of line.runs) {
      drawRun(ctx, screen, state, run, row);
    }
  }

  const cursorRow = CONTENT_TOP + layout.totalRows - state.scroll;
  if (state.cursorOn && cursorRow < CONTENT_TOP + visible) {
    ctx.fillStyle = palette.phosphor;
    ctx.fillRect(grid.margin * CELL_W, cursorRow * CELL_H, CELL_W, CELL_H);
  }
  ctx.restore();
}

function drawIndex(
  ctx: CanvasRenderingContext2D,
  screen: Screen,
  state: ScreenState
) {
  const { index } = screen.grid;
  if (!index) {
    return;
  }
  const { palette } = screen;
  const active = activeSection(screen, state.scroll);
  setFont(ctx, 1);
  ctx.fillStyle = palette.faint;
  textAt(ctx, screen, "INDEX", index.col + 1, CONTENT_TOP);
  for (const [i, section] of screen.layout.sections.entries()) {
    const row = INDEX_TOP + i;
    const lit = i === active || i === state.hoverSection;
    if (lit) {
      ctx.fillStyle = palette.phosphor;
      ctx.fillRect(
        index.col * CELL_W,
        row * CELL_H,
        index.width * CELL_W,
        CELL_H
      );
    }
    ctx.fillStyle = lit ? palette.glass : palette.dim;
    const label = `${String(i + 1).padStart(2, "0")}  ${section.label}`;
    textAt(ctx, screen, label.slice(0, index.width - 2), index.col + 1, row);
  }
}

function drawBars(
  ctx: CanvasRenderingContext2D,
  screen: Screen,
  state: ScreenState
) {
  const { grid, palette } = screen;
  setFont(ctx, 1);

  ctx.fillStyle = palette.phosphor;
  ctx.fillRect(0, 0, grid.cols * CELL_W, CELL_H);
  ctx.fillStyle = palette.glass;
  textAt(ctx, screen, screen.title, 1, 0);
  textAt(
    ctx,
    screen,
    screen.path,
    Math.floor((grid.cols - screen.path.length) / 2),
    0
  );
  textAt(ctx, screen, state.clock, grid.cols - state.clock.length - 1, 0);

  const last = grid.rows - 1;
  const pad = (n: number) => String(n).padStart(3, "0");
  const position = `ROW ${pad(state.scroll + 1)}/${pad(maxScroll(screen) + 1)}`;
  const room = grid.cols - position.length - 3;
  const hints = HINTS.length <= room ? HINTS : SHORT_HINTS;
  ctx.fillStyle = palette.faint;
  textAt(ctx, screen, (state.status ?? hints).slice(0, room), 1, last);
  textAt(ctx, screen, position, grid.cols - position.length - 1, last);
}

export function drawScreen(
  ctx: CanvasRenderingContext2D,
  screen: Screen,
  state: ScreenState
) {
  ctx.fillStyle = screen.palette.glass;
  ctx.fillRect(0, 0, screen.grid.cols * CELL_W, screen.grid.rows * CELL_H);
  ctx.textBaseline = "alphabetic";
  drawContent(ctx, screen, state);
  drawIndex(ctx, screen, state);
  drawBars(ctx, screen, state);
}
