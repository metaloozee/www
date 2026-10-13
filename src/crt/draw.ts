import {
  DAY_PX,
  type FigureLine,
  figureBySrc,
  type GraphLine,
  lineRows,
  type Run,
  runWidth,
  type ScreenLayout,
  type Tone,
  transportCols,
} from "./layout";

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
  // Index into the contribution days under the pointer.
  day?: number;
  focus?: number;
  // Src of the figure that has the whole screen: the page and INDEX are
  // not drawn.
  fullFigure?: string;
  hover?: number;
  hoverSection?: number;
  // Pointer or keyboard focus on the HUMAN/AGENT switch.
  modeHover?: boolean;
  scroll: number;
  soundHover?: boolean;
  soundOn: boolean;
  status?: string;
}

export interface Screen {
  ascent: number;
  grid: Grid;
  // Figure pictures by src, once loaded.
  images: Map<string, CanvasImageSource>;
  layout: ScreenLayout;
  palette: Palette;
  title: string;
  // Clips by their figure's src: the <video> elements of the HTML copy.
  videos: Map<string, HTMLVideoElement>;
}

const HINTS = "↑↓ SCROLL    TAB LINKS    ENTER OPEN";
const SHORT_HINTS = "↑↓ SCROLL";
const CLIP_HINTS = "SPACE PLAY/PAUSE    ESC EXIT FULL SCREEN";
const PICTURE_HINTS = "ESC EXIT FULL SCREEN";
const DAY_SQUARE = 6;

// Row 0 is the title bar and the last row the status bar. Two blank rows
// of glass sit under the title bar and one above the status bar.
export const CONTENT_TOP = 3;
export const viewportRows = (grid: Grid) =>
  Math.max(1, grid.rows - CONTENT_TOP - 2);

// INDEX sits level with the lower half of the 2x heading; its entries
// line up with the first paragraph.
const INDEX_LABEL_ROW = CONTENT_TOP + 3;
export const INDEX_TOP = INDEX_LABEL_ROW + 2;

// Scroll row each INDEX entry jumps to and lights up at: the section's
// first row. The
// sections at the tail fit on the last screen and can never reach the top,
// so they share out the scroll that is left, the last one taking the end.
export function sectionStops(screen: Screen) {
  const max = maxScroll(screen);
  const { sections } = screen.layout;
  const tail = sections.findIndex((section) => section.row > max);
  const reachable = tail === -1 ? sections.length : tail;
  const base = Math.min(max, sections[reachable - 1]?.row ?? 0);
  const share = (max - base) / (sections.length - reachable);
  const stops = sections.map((section, i) =>
    i < reachable ? section.row : base + Math.ceil(share * (i - reachable + 1))
  );
  // Keep every stop a row apart so each entry can light up.
  for (let i = stops.length - 2; i >= 0; i -= 1) {
    stops[i] = Math.max(0, Math.min(stops[i] ?? 0, (stops[i + 1] ?? 0) - 1));
  }
  return stops;
}

// Section the reader is in: the last one whose stop is at or above the top
// visible row.
export function activeSection(screen: Screen, scroll: number) {
  let active = 0;
  for (const [i, stop] of sectionStops(screen).entries()) {
    if (scroll > 0 && stop <= scroll) {
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

export const setFont = (ctx: CanvasRenderingContext2D, size: number) => {
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
  // Only real links are underlined; a role toggle is not one.
  const toggle = isLink && screen.layout.links[run.link ?? -1]?.toggle;
  if (isLink && !(active || toggle)) {
    ctx.fillRect(x, y + (CELL_H - 2) * size, w, size);
  }
}

const LEVEL_TONE: Tone[] = ["ghost", "faint", "dim", "phosphor", "hot"];

function drawGraph(
  ctx: CanvasRenderingContext2D,
  screen: Screen,
  state: ScreenState,
  graph: GraphLine,
  row: number
) {
  const { margin } = screen.grid;
  const inset = (DAY_PX - DAY_SQUARE) / 2;
  for (const [i, day] of graph.grid.days.entries()) {
    const week = day.week - graph.offset;
    if (week < 0) {
      continue;
    }
    const x = (margin + week) * CELL_W + inset;
    const y = row * CELL_H + day.weekday * DAY_PX + inset;
    ctx.fillStyle = screen.palette[LEVEL_TONE[day.level] ?? "ghost"];
    ctx.fillRect(x, y, DAY_SQUARE, DAY_SQUARE);
    if (i === state.day) {
      ctx.strokeStyle = screen.palette.hot;
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 0.5, y - 0.5, DAY_SQUARE + 1, DAY_SQUARE + 1);
    }
  }
}

const clockText = (seconds: number) => {
  if (!Number.isFinite(seconds)) {
    return "--:--";
  }
  const whole = Math.floor(seconds);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(whole / 60))}:${pad(whole % 60)}`;
};

// A clip counts as started once it has a frame other than its poster.
const hasFrame = (video: HTMLVideoElement) =>
  video.readyState >= 2 && (video.currentTime > 0 || !video.paused);

export const isPlaying = (video: HTMLVideoElement) =>
  !(video.paused || video.ended);

// Where a figure is drawn: `col` and `row` in cells, size in font pixels.
export interface MediaRect {
  col: number;
  height: number;
  row: number;
  width: number;
}

// The largest whole-cell box of the figure's shape that fits between the
// bars, centred, with a row kept under a clip for its controls.
export function fullRect(grid: Grid, figure: FigureLine): MediaRect {
  const controls = figure.video ? 1 : 0;
  const rows = viewportRows(grid) - controls;
  const aspect = figure.width / figure.height;
  const cols = Math.max(
    1,
    Math.min(grid.cols - 2, Math.floor((rows * CELL_H * aspect) / CELL_W))
  );
  const width = cols * CELL_W;
  const height = Math.round(width / aspect);
  const used = Math.ceil(height / CELL_H) + controls;
  return {
    col: Math.floor((grid.cols - cols) / 2),
    height,
    row: CONTENT_TOP + Math.floor((viewportRows(grid) - used) / 2),
    width,
  };
}

// The row under a clip: play or pause glyph, a bar of cells like the boot
// progress bar, elapsed over total time, and the full-screen switch.
function drawTransport(
  ctx: CanvasRenderingContext2D,
  screen: Screen,
  state: ScreenState,
  video: HTMLVideoElement | undefined,
  rect: MediaRect
) {
  const { palette } = screen;
  const row = rect.row + Math.ceil(rect.height / CELL_H);
  const { bar, clock, full } = transportCols(Math.floor(rect.width / CELL_W));
  const elapsed = video?.currentTime ?? 0;
  const total = video?.duration ?? Number.NaN;
  const filled = Number.isFinite(total)
    ? Math.round((elapsed / total) * (bar.end - bar.start))
    : 0;
  setFont(ctx, 1);
  ctx.fillStyle = palette.phosphor;
  textAt(ctx, screen, video && isPlaying(video) ? "▐▐" : "►", rect.col, row);
  for (let col = bar.start; col < bar.end; col += 1) {
    ctx.fillStyle = col - bar.start < filled ? palette.phosphor : palette.ghost;
    ctx.fillRect(
      (rect.col + col) * CELL_W + 1,
      row * CELL_H + 4,
      CELL_W - 2,
      CELL_H - 8
    );
  }
  ctx.fillStyle = palette.faint;
  textAt(
    ctx,
    screen,
    `${clockText(elapsed)}/${clockText(total)}`,
    rect.col + clock,
    row
  );
  ctx.fillStyle = palette.phosphor;
  const label = state.fullFigure === undefined ? "[FULL]" : "[EXIT]";
  textAt(ctx, screen, label, rect.col + full, row);
}

// A picture or a playing clip, in its own colours: the glass still curves,
// fringes and scans it. Until the picture loads the frame holds its place.
// Keyboard focus on the figure's control lights the frame.
function drawFigure(
  ctx: CanvasRenderingContext2D,
  screen: Screen,
  state: ScreenState,
  figure: FigureLine,
  rect: MediaRect
) {
  const { palette } = screen;
  const x = rect.col * CELL_W;
  const y = rect.row * CELL_H;
  const video = screen.videos.get(figure.src);
  const sharp =
    state.fullFigure !== undefined && figure.full !== undefined
      ? screen.images.get(figure.full)
      : undefined;
  const image =
    video && hasFrame(video) ? video : (sharp ?? screen.images.get(figure.src));
  if (figure.video) {
    drawTransport(ctx, screen, state, video, rect);
  }
  if (image) {
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(image, x, y, rect.width, rect.height);
  } else {
    setFont(ctx, 1);
    ctx.fillStyle = palette.faint;
    textAt(ctx, screen, "LOADING PICTURE ...", rect.col + 2, rect.row + 1);
  }
  const focused = figure.link !== undefined && figure.link === state.focus;
  ctx.strokeStyle = focused ? palette.hot : palette.faint;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, rect.width - 1, rect.height - 1);
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
    if (row + lineRows(line) <= CONTENT_TOP || row >= bottom) {
      continue;
    }
    if (line.graph) {
      drawGraph(ctx, screen, state, line.graph, row);
    }
    if (line.figure) {
      const { height, width } = line.figure;
      drawFigure(ctx, screen, state, line.figure, {
        col: grid.margin,
        height,
        row,
        width,
      });
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
  textAt(ctx, screen, "INDEX", index.col + 1, INDEX_LABEL_ROW);
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
    const label = `${String(i + 1).padStart(2, "0")} ${section.label}`;
    textAt(ctx, screen, label.slice(0, index.width - 2), index.col + 1, row);
  }
}

// The CRT is always in HUMAN mode, so HUMAN is the lit segment, in reverse
// video against the inverted title bar. AGENT gets a box on hover or focus.
const HUMAN_SEGMENT = " HUMAN ";
const AGENT_SEGMENT = " AGENT ";
const MODE_SWITCH_WIDTH = HUMAN_SEGMENT.length + AGENT_SEGMENT.length;

// Title-bar columns of the switch, right of which sits the clock.
export function modeSwitchCols(grid: Grid, clock: string) {
  const end = grid.cols - clock.length - 3;
  return { end, start: end - MODE_SWITCH_WIDTH };
}

// Speaker icon one cell left of the mode switch: sound waves while on, an
// X while muted. Drawn pixel by pixel so it stays as crisp as the font.
const SOUND_CELLS = 3;
const SPEAKER_ON = [
  ".....#...#..",
  "....##....#.",
  "...###.#...#",
  "######..#..#",
  "######..#..#",
  "######..#..#",
  "######..#..#",
  "...###.#...#",
  "....##....#.",
  ".....#...#..",
];
const SPEAKER_OFF = [
  ".....#......",
  "....##......",
  "...###......",
  "######.#...#",
  "######..#.#.",
  "######...#..",
  "######..#.#.",
  "...###.#...#",
  "....##......",
  ".....#......",
];

export function soundSwitchCols(grid: Grid, clock: string) {
  const end = modeSwitchCols(grid, clock).start - 1;
  return { end, start: end - SOUND_CELLS };
}

function drawSoundSwitch(
  ctx: CanvasRenderingContext2D,
  screen: Screen,
  state: ScreenState
) {
  const { start } = soundSwitchCols(screen.grid, state.clock);
  const x = start * CELL_W;
  const w = SOUND_CELLS * CELL_W;
  ctx.fillStyle = screen.palette.glass;
  if (state.soundHover) {
    ctx.strokeStyle = screen.palette.glass;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, 0.5, w - 1, CELL_H - 1);
  }
  const icon = state.soundOn ? SPEAKER_ON : SPEAKER_OFF;
  const left = x + Math.floor((w - (icon[0]?.length ?? 0)) / 2);
  const top = Math.floor((CELL_H - icon.length) / 2);
  for (const [row, line] of icon.entries()) {
    for (const [col, pixel] of [...line].entries()) {
      if (pixel === "#") {
        ctx.fillRect(left + col, top + row, 1, 1);
      }
    }
  }
}

function drawModeSwitch(
  ctx: CanvasRenderingContext2D,
  screen: Screen,
  state: ScreenState
) {
  const { palette } = screen;
  const { start } = modeSwitchCols(screen.grid, state.clock);
  const agent = start + HUMAN_SEGMENT.length;
  ctx.fillStyle = palette.glass;
  ctx.fillRect(start * CELL_W, 0, HUMAN_SEGMENT.length * CELL_W, CELL_H);
  if (state.modeHover) {
    ctx.strokeStyle = palette.glass;
    ctx.lineWidth = 1;
    ctx.strokeRect(
      agent * CELL_W + 0.5,
      0.5,
      AGENT_SEGMENT.length * CELL_W - 1,
      CELL_H - 1
    );
  }
  ctx.fillStyle = palette.phosphor;
  textAt(ctx, screen, HUMAN_SEGMENT, start, 0);
  ctx.fillStyle = palette.glass;
  textAt(ctx, screen, AGENT_SEGMENT, agent, 0);
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
  textAt(ctx, screen, state.clock, grid.cols - state.clock.length - 1, 0);
  drawModeSwitch(ctx, screen, state);
  drawSoundSwitch(ctx, screen, state);

  const last = grid.rows - 1;
  const pad = (n: number) => String(n).padStart(3, "0");
  // In full screen the page is hidden, so its position and keys are too.
  const shown =
    state.fullFigure === undefined
      ? undefined
      : figureBySrc(screen.layout, state.fullFigure);
  const position = shown
    ? ""
    : `ROW ${pad(state.scroll + 1)}/${pad(maxScroll(screen) + 1)}`;
  const room = grid.cols - position.length - 3;
  const pageHints = HINTS.length <= room ? HINTS : SHORT_HINTS;
  let hints = pageHints;
  if (shown) {
    hints = shown.video ? CLIP_HINTS : PICTURE_HINTS;
  }
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
  const shown =
    state.fullFigure === undefined
      ? undefined
      : figureBySrc(screen.layout, state.fullFigure);
  if (shown) {
    drawFigure(ctx, screen, state, shown, fullRect(screen.grid, shown));
  } else {
    drawContent(ctx, screen, state);
    drawIndex(ctx, screen, state);
  }
  drawBars(ctx, screen, state);
}
