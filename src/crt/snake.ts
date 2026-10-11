// Snake in the space under the INDEX column. At rest a demo snake plays
// itself behind a title and prompt; a real game takes the arrow keys, and
// full screen swaps the page for a larger field.

import {
  CELL_H,
  CELL_W,
  CONTENT_TOP,
  type Grid,
  INDEX_TOP,
  type Palette,
  type Screen,
  setFont,
  viewportRows,
} from "./draw";
import { play } from "./sound";

// Side of one game cell in font pixels: half a character cell in the
// panel, like a day of the contribution graph, and a whole one full screen.
const PANEL_CELL = 8;
const FULL_CELL = 16;
const MAX_PANEL_ROWS = 14;
const MIN_ROWS = 6;

const START_MS = 120;
const MIN_MS = 70;
const SPEEDUP_MS = 2;
const DEMO_MS = 140;
const OVER_MS = 1500;
const BLINK_MS = 530;
const START_LENGTH = 4;
// The demo starts over at this length, before it can box itself in.
const DEMO_MAX_LENGTH = 16;
const MAX_QUEUED_TURNS = 2;
const DIM_ALPHA = 0.7;
const STORAGE_KEY = "crt-snake-hi";

const TITLE = "SNAKE";
const PROMPT = "PRESS G TO PLAY";
const GAME_OVER = "GAME OVER";
// The border is a row of dots: this many pixels lit, out of every DOT_STEP.
const DOT = 2;
const DOT_STEP = 4;

type Dir = readonly [number, number];
const RIGHT: Dir = [1, 0];
const DOWN: Dir = [0, 1];
const LEFT: Dir = [-1, 0];
const UP: Dir = [0, -1];
const DIRS = [RIGHT, DOWN, LEFT, UP];
const TURN_KEYS: Record<string, Dir> = {
  a: LEFT,
  arrowdown: DOWN,
  arrowleft: LEFT,
  arrowright: RIGHT,
  arrowup: UP,
  d: RIGHT,
  s: DOWN,
  w: UP,
};

export const scoreText = (n: number) => String(n).padStart(4, "0");
const reverses = (a: Dir, b: Dir) => a[0] === -b[0] && a[1] === -b[1];

function readHi() {
  try {
    return Number(localStorage.getItem(STORAGE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveHi(hi: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(hi));
  } catch {
    // Keeps the score for this visit only.
  }
}

// Where the game sits, in character cells.
export interface GameRect {
  cell: number;
  col: number;
  cols: number;
  row: number;
  rows: number;
}

// The panel needs the INDEX column and room under its entries; without
// them there is no game, full screen or not.
export function gameRect(
  grid: Grid,
  sections: number,
  full: boolean
): GameRect | undefined {
  if (!grid.index) {
    return;
  }
  const top = INDEX_TOP + sections + 2;
  const bottom = CONTENT_TOP + viewportRows(grid);
  const rows = Math.min(MAX_PANEL_ROWS, bottom - top);
  if (rows < MIN_ROWS) {
    return;
  }
  if (!full) {
    return {
      cell: PANEL_CELL,
      col: grid.index.col,
      cols: grid.index.width,
      row: bottom - rows,
      rows,
    };
  }
  return {
    cell: FULL_CELL,
    col: 0,
    // A full-screen cell is two characters wide.
    cols: grid.cols - (grid.cols % 2),
    row: CONTENT_TOP,
    rows: viewportRows(grid),
  };
}

export class SnakeGame {
  cols = 1;
  food = 0;
  hi = readHi();
  mode: "demo" | "playing" | "over" = "demo";
  promptOn = true;
  rows = 1;
  score = 0;
  // Cell indices, head first.
  snake: number[] = [];
  private dir = RIGHT;
  private turns: Dir[] = [];
  private stepAt = 0;
  private overAt = 0;

  get playing() {
    return this.mode === "playing";
  }

  // A game is on screen, running or just lost: it keeps the keys, so a
  // late turn after the crash does not scroll the page.
  get active() {
    return this.mode !== "demo";
  }

  resize(cols: number, rows: number) {
    if (cols !== this.cols || rows !== this.rows) {
      this.cols = cols;
      this.rows = rows;
      this.demo();
    }
  }

  start() {
    this.spawn(Math.floor(this.rows / 2));
    this.score = 0;
    this.stepAt = 0;
    this.mode = "playing";
    play("tick");
  }

  quit() {
    this.demo();
  }

  turn(key: string) {
    const dir = TURN_KEYS[key];
    if (dir && this.turns.length < MAX_QUEUED_TURNS) {
      this.turns.push(dir);
    }
  }

  // True when the picture changed. Under reduced motion the demo holds
  // still; a game the reader started still runs.
  update(now: number, motion: boolean) {
    const promptOn = !motion || Math.floor(now / BLINK_MS) % 2 === 0;
    const blinked = promptOn !== this.promptOn && this.mode === "demo";
    this.promptOn = promptOn;
    if (this.mode === "over") {
      if (now - this.overAt < OVER_MS) {
        return blinked;
      }
      this.demo();
      return true;
    }
    const pace = this.playing
      ? Math.max(MIN_MS, START_MS - this.score * SPEEDUP_MS)
      : DEMO_MS;
    if ((this.mode === "demo" && !motion) || now - this.stepAt < pace) {
      return blinked;
    }
    this.stepAt = now;
    if (this.playing) {
      this.playStep(now);
    } else {
      this.demoStep();
    }
    return true;
  }

  private demo() {
    // Off centre, so the demo starts clear of the title.
    this.spawn(Math.floor(this.rows / 4));
    this.score = 0;
    this.mode = "demo";
  }

  private spawn(y: number) {
    // Left of centre: heading right, that leaves time for a first turn.
    const x = Math.max(START_LENGTH, Math.floor(this.cols / 4));
    this.snake = Array.from(
      { length: START_LENGTH },
      (_, i) => y * this.cols + x - i
    );
    this.dir = RIGHT;
    this.turns = [];
    this.placeFood();
  }

  private placeFood() {
    do {
      this.food = Math.floor(Math.random() * this.cols * this.rows);
    } while (this.snake.includes(this.food));
  }

  // Cell the head would enter, or undefined for a wall or the body. The
  // tail moves out of the way, so it does not count.
  private ahead(dir: Dir) {
    const head = this.snake[0] ?? 0;
    const x = (head % this.cols) + dir[0];
    const y = Math.floor(head / this.cols) + dir[1];
    const next = y * this.cols + x;
    const outside = x < 0 || y < 0 || x >= this.cols || y >= this.rows;
    return outside || this.snake.slice(0, -1).includes(next) ? undefined : next;
  }

  private move(next: number) {
    this.snake.unshift(next);
    if (next !== this.food) {
      this.snake.pop();
      return false;
    }
    this.placeFood();
    return true;
  }

  private playStep(now: number) {
    const turn = this.turns.shift();
    if (turn && !reverses(turn, this.dir)) {
      this.dir = turn;
    }
    const next = this.ahead(this.dir);
    if (next === undefined) {
      if (this.score > this.hi) {
        this.hi = this.score;
        saveHi(this.hi);
      }
      this.mode = "over";
      this.overAt = now;
      play("beep");
      return;
    }
    if (this.move(next)) {
      this.score += 1;
      play("step");
    }
  }

  // Heads for the food by the shortest safe step, preferring to keep
  // straight. Silent: nobody asked for this game.
  private demoStep() {
    const fx = this.food % this.cols;
    const fy = Math.floor(this.food / this.cols);
    let best: { cost: number; dir: Dir; next: number } | undefined;
    for (const dir of DIRS) {
      const next = reverses(dir, this.dir) ? undefined : this.ahead(dir);
      if (next === undefined) {
        continue;
      }
      const distance =
        Math.abs((next % this.cols) - fx) +
        Math.abs(Math.floor(next / this.cols) - fy);
      const cost = distance * 2 + (dir === this.dir ? 0 : 1);
      if (!best || cost < best.cost) {
        best = { cost, dir, next };
      }
    }
    if (!best || this.snake.length >= DEMO_MAX_LENGTH) {
      this.demo();
      return;
    }
    this.dir = best.dir;
    this.move(best.next);
  }
}

export interface GameView {
  // 0 with the rest of the screen at full brightness, 1 fully dimmed.
  dim: number;
  full: boolean;
  // The pointer is over the field, where a click starts a game.
  hover: boolean;
  rect: GameRect;
}

interface FieldBox {
  h: number;
  w: number;
}

// Left edge that centres `cols` characters of `size` text on the grid.
const centred = (box: FieldBox, cols: number, size: number) =>
  Math.floor((box.w - cols * CELL_W * size) / 2 / CELL_W) * CELL_W;

function drawField(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  game: SnakeGame,
  cell: number,
  box: FieldBox
) {
  const live = game.mode !== "demo";
  const square = (index: number, size: number) => {
    const inset = (cell - size) / 2;
    ctx.fillRect(
      (index % game.cols) * cell + inset,
      Math.floor(index / game.cols) * cell + inset,
      size,
      size
    );
  };
  // Dotted, so the walls are there without boxing the panel in.
  ctx.fillStyle = palette.faint;
  for (let x = 0; x < box.w; x += DOT_STEP) {
    ctx.fillRect(x, 0, DOT, 1);
    ctx.fillRect(x, box.h - 1, DOT, 1);
  }
  for (let y = 0; y < box.h; y += DOT_STEP) {
    ctx.fillRect(0, y, 1, DOT);
    ctx.fillRect(box.w - 1, y, 1, DOT);
  }
  ctx.fillStyle = live ? palette.hot : palette.faint;
  square(game.food, cell / 2);
  for (const [i, index] of game.snake.entries()) {
    const head = live ? palette.hot : palette.dim;
    const body = live ? palette.dim : palette.faint;
    ctx.fillStyle = i === 0 ? head : body;
    square(index, cell - 2);
  }
}

// One line of text centred in the field, in reverse video when `lit`.
function drawLine(
  ctx: CanvasRenderingContext2D,
  screen: Screen,
  box: FieldBox,
  line: { lit?: boolean; size?: number; text: string; tone: string; y: number }
) {
  const size = line.size ?? 1;
  const x = centred(box, line.text.length, size);
  setFont(ctx, size);
  if (line.lit) {
    ctx.fillStyle = screen.palette.phosphor;
    ctx.fillRect(
      x - CELL_W,
      line.y,
      (line.text.length * size + 2) * CELL_W,
      CELL_H * size
    );
  }
  ctx.fillStyle = line.lit ? screen.palette.glass : line.tone;
  ctx.fillText(line.text, x, line.y + screen.ascent * size);
  setFont(ctx, 1);
}

// Title, prompt and high score over the demo, on a cleared patch so the
// snake passes behind them.
function drawAttract(
  ctx: CanvasRenderingContext2D,
  screen: Screen,
  game: SnakeGame,
  view: GameView,
  box: FieldBox
) {
  const { palette } = screen;
  const size = view.full ? 4 : 2;
  const titleH = CELL_H * size;
  const blockH = titleH + 3 * CELL_H;
  const top = Math.floor((box.h - blockH) / 2 / CELL_H) * CELL_H;
  const blockCols = Math.max(TITLE.length * size, PROMPT.length) + 2;
  ctx.fillStyle = palette.glass;
  ctx.fillRect(
    centred(box, blockCols, 1),
    top - CELL_H / 2,
    blockCols * CELL_W,
    blockH + CELL_H
  );
  drawLine(ctx, screen, box, {
    size,
    text: TITLE,
    tone: palette.phosphor,
    y: top,
  });
  if (view.hover || game.promptOn) {
    drawLine(ctx, screen, box, {
      lit: view.hover,
      text: PROMPT,
      tone: palette.dim,
      y: top + titleH + CELL_H,
    });
  }
  drawLine(ctx, screen, box, {
    text: `HI ${scoreText(game.hi)}`,
    tone: palette.faint,
    y: top + titleH + 2 * CELL_H,
  });
}

// Drawn over the finished screen: dims everything but the status bar, then
// repaints the game at full brightness.
export function drawGame(
  ctx: CanvasRenderingContext2D,
  screen: Screen,
  game: SnakeGame,
  view: GameView
) {
  const { grid, palette } = screen;
  const { rect } = view;
  if (view.dim > 0) {
    ctx.globalAlpha = DIM_ALPHA * view.dim;
    ctx.fillStyle = palette.glass;
    ctx.fillRect(0, 0, grid.cols * CELL_W, (grid.rows - 1) * CELL_H);
    ctx.globalAlpha = 1;
  }
  const x = rect.col * CELL_W;
  const y = rect.row * CELL_H;
  const box = { h: rect.rows * CELL_H, w: rect.cols * CELL_W };
  ctx.fillStyle = palette.glass;
  ctx.fillRect(x, y, box.w, box.h);

  ctx.save();
  ctx.translate(x, y);
  drawField(ctx, palette, game, rect.cell, box);
  if (game.mode === "demo") {
    drawAttract(ctx, screen, game, view, box);
  } else if (game.mode === "over") {
    const top = Math.floor((box.h - 2 * CELL_H) / 2 / CELL_H) * CELL_H;
    drawLine(ctx, screen, box, {
      lit: true,
      text: GAME_OVER,
      tone: palette.phosphor,
      y: top,
    });
    drawLine(ctx, screen, box, {
      text: `SCORE ${scoreText(game.score)}`,
      tone: palette.dim,
      y: top + CELL_H,
    });
  }
  ctx.restore();
}
