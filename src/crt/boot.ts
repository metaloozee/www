import { CELL_H, CELL_W, FONT_FAMILY, type Grid, type Palette } from "./draw";

export const BOOT_CELLS = 14;

const TITLE = "Ayan Parkar, Personal Terminal";
const VERSION = "Version 2026.1";
const COPYRIGHT = "Copyright (c) Ayan Parkar, 2026. Mumbai, India.";
const SHORT_COPYRIGHT = "(c) Ayan Parkar, 2026.";
const STEP_WIDTH = 29;
const BAR_ROWS = 2;
// Rows under the portrait: gap, title, version, gap, bar, gap, step, gap,
// prompt, gap, copyright. The prompt row is kept even while empty so
// nothing shifts when it appears.
const TEXT_ROWS = 1 + 1 + 1 + 2 + BAR_ROWS + 1 + 1 + 1 + 1 + 2 + 1;

export interface BootStep {
  done: boolean;
  file: string;
}

export interface BootFrame {
  filled: number;
  // Shown once loading is done, while the boot waits for a key press.
  prompt?: string;
  step: BootStep;
  stepOk: boolean;
}

// Status line under the bar, padded so it doesn't shift as OK appears.
export const stepLine = ({ step, stepOk }: BootFrame) =>
  `${`Loading ${step.file} `.padEnd(STEP_WIDTH, ".")} ${stepOk ? "OK" : "  "}`;

// Largest whole scale (font pixels per art pixel) that leaves room for the
// text; 0 drops the portrait on very short screens.
function portraitScale(portrait: HTMLImageElement | undefined, rows: number) {
  if (!portrait) {
    return 0;
  }
  for (const scale of [2, 1]) {
    const art = Math.ceil((portrait.height * scale) / CELL_H);
    if (art + TEXT_ROWS <= rows) {
      return scale;
    }
  }
  return 0;
}

export function drawBoot(
  ctx: CanvasRenderingContext2D,
  grid: Grid,
  palette: Palette,
  ascent: number,
  portrait: HTMLImageElement | undefined,
  frame: BootFrame
) {
  const { cols, rows } = grid;
  const width = cols * CELL_W;
  ctx.fillStyle = palette.glass;
  ctx.fillRect(0, 0, width, rows * CELL_H);

  const scale = portraitScale(portrait, rows);
  const artRows =
    portrait && scale ? Math.ceil((portrait.height * scale) / CELL_H) : 0;
  let row = Math.max(0, Math.floor((rows - artRows - TEXT_ROWS) / 2));

  if (portrait && scale) {
    const w = portrait.width * scale;
    const h = portrait.height * scale;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      portrait,
      Math.floor((width - w) / 2),
      (row + artRows) * CELL_H - h,
      w,
      h
    );
    row += artRows;
  }

  ctx.font = `${CELL_H}px "${FONT_FAMILY}"`;
  const centred = (text: string, tone: keyof Palette) => {
    ctx.fillStyle = palette[tone];
    const col = Math.floor((cols - text.length) / 2);
    ctx.fillText(text, col * CELL_W, row * CELL_H + ascent);
  };

  row += 1;
  centred(TITLE, "dim");
  row += 1;
  centred(VERSION, "dim");
  row += 3;

  // Outline, then one segment per step of progress, each a few cells wide.
  const segmentCols = cols >= BOOT_CELLS * 3 + 4 ? 3 : 2;
  const barCols = BOOT_CELLS * segmentCols + 2;
  const x0 = Math.floor((cols - barCols) / 2) * CELL_W;
  const y0 = row * CELL_H;
  const barH = BAR_ROWS * CELL_H;
  ctx.strokeStyle = palette.phosphor;
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 + 0.5, y0 + 0.5, barCols * CELL_W - 1, barH - 1);
  for (let i = 0; i < BOOT_CELLS; i += 1) {
    ctx.fillStyle = i < frame.filled ? palette.phosphor : palette.ghost;
    ctx.fillRect(
      x0 + (1 + i * segmentCols) * CELL_W + 1,
      y0 + 4,
      segmentCols * CELL_W - 2,
      barH - 8
    );
  }
  row += BAR_ROWS + 1;

  centred(stepLine(frame), "faint");
  row += 2;
  if (frame.prompt) {
    centred(frame.prompt, "phosphor");
  }
  row += 3;
  centred(COPYRIGHT.length <= cols ? COPYRIGHT : SHORT_COPYRIGHT, "dim");
}
