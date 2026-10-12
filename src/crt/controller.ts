import type { ContributionDay } from "@/lib/github-contributions";
import {
  BOOT_CELLS,
  type BootFrame,
  type BootStep,
  drawBoot,
  stepLine,
} from "./boot";
import type { OpenRoles, ScreenDoc } from "./doc";
import {
  CELL_H,
  CELL_W,
  CONTENT_TOP,
  drawScreen,
  FONT_FAMILY,
  type Grid,
  maxScroll,
  modeSwitchCols,
  type Palette,
  type Screen,
  type ScreenState,
  sectionAt,
  sectionStops,
  soundSwitchCols,
  viewportRows,
} from "./draw";
import { dayAt, layoutDoc, linkAtCell, type ScreenLink } from "./layout";
import { barrel, CrtRenderer, type Rgb } from "./shader";
import { drawGame, gameRect, SnakeGame, scoreText } from "./snake";
import { play, soundEnabled, subscribeSound, toggleSound } from "./sound";

const MEASURE = 72;
const MIN_MEASURE = 60;
const WIDE_SCREEN = 640;
// A phone on its side is wide but short: larger cells would leave it a
// handful of rows.
const TALL_SCREEN = 480;
const LARGE_SCREEN = 1920;
const BLINK_MS = 530;
const INDEX_WIDTH = 28;
const INDEX_GAP = 4;
const TYPING_TAGS = /^(INPUT|TEXTAREA|SELECT)$/;
const SOFTWARE_GL = /swiftshader|llvmpipe|softpipe|software|basic render/i;
const PORTRAIT_URL = "/boot/portrait.png";
// The bar fills over BOOT_MS unless loading is slower, then holds full.
const BOOT_MS = 900;
const BOOT_HOLD_MS = 250;
const POWER_MS = 400;
// Lets the click sound start before the new tab takes focus.
const LINK_OPEN_DELAY_MS = 40;
// Sweeping the pointer across several links ticks at most this often.
const HOVER_SOUND_GAP_MS = 60;
const AGENT_STATUS = "SWITCH TO AGENT VIEW";
const PLAYING_STATUS = "↑↓←→ MOVE    ESC QUIT";
const PLAY_STATUS = "CLICK OR PRESS G TO PLAY";
// The rest of the screen fades down over this long when a game starts.
const DIM_MS = 200;
const soundStatus = () =>
  soundEnabled() ? "SOUND ON · CLICK TO MUTE" : "SOUND OFF · CLICK TO UNMUTE";
const linkStatus = (link?: ScreenLink) => {
  if (link?.toggle) {
    return link.toggle.open ? "COLLAPSE ROLE" : "EXPAND ROLE";
  }
  return link?.href;
};
const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const clock = () =>
  new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

function toRgb(color: string): Rgb {
  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) {
    return [0, 0, 0];
  }
  probe.fillStyle = color;
  probe.fillRect(0, 0, 1, 1);
  const [r = 0, g = 0, b = 0] = probe.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
}

function readTokens() {
  const root = getComputedStyle(document.documentElement);
  const token = (name: string) =>
    root.getPropertyValue(`--color-${name}`).trim();
  const palette: Palette = {
    dim: token("phosphor-dim"),
    faint: token("phosphor-faint"),
    ghost: token("phosphor-ghost"),
    glass: token("glass"),
    hot: token("phosphor-hot"),
    phosphor: token("phosphor"),
  };
  return { palette, tube: token("tube") };
}

// CPU rasterisers (headless Chrome, VMs, blocklisted GPUs) that
// failIfMajorPerformanceCaveat does not always catch.
function isSoftwareGl(gl: WebGL2RenderingContext) {
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  const renderer: unknown = gl.getParameter(
    info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER
  );
  return SOFTWARE_GL.test(String(renderer));
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || TYPING_TAGS.test(target.tagName));

// 1x cells on narrow glass, 1.5x (24px rows) on laptops and desktops, 2x
// on very wide glass. The shader's sharp-bilinear sampling keeps 1.5x
// crisp. The grid spans the glass less an edge kept clear of the curve;
// wide grids keep the INDEX column flush right and widen the prose to
// meet it.
function cellScale(width: number, height: number) {
  if (width >= LARGE_SCREEN) {
    return 2;
  }
  return width >= WIDE_SCREEN && height >= TALL_SCREEN ? 1.5 : 1;
}

function fitGrid(width: number, height: number) {
  const scale = cellScale(width, height);
  const cellW = CELL_W * scale;
  const cellH = CELL_H * scale;
  const edgeCols = scale > 1 ? 5 : 3;
  const edgeY = 1.5 * cellH;
  const cols = Math.max(1, Math.floor(width / cellW) - 2 * edgeCols);
  const rows = Math.max(1, Math.floor((height - 2 * edgeY) / cellH));
  const indexMeasure = cols - INDEX_GAP - INDEX_WIDTH;
  const measure = Math.max(1, Math.min(MEASURE, cols));
  const grid: Grid =
    indexMeasure >= MIN_MEASURE
      ? {
          cols,
          index: { col: cols - INDEX_WIDTH, width: INDEX_WIDTH },
          margin: 0,
          measure: indexMeasure,
          rows,
        }
      : { cols, margin: Math.floor((cols - measure) / 2), measure, rows };
  return {
    box: {
      h: rows * cellH,
      w: cols * cellW,
      x: Math.floor((width - cols * cellW) / 2),
      y: Math.floor((height - rows * cellH) / 2),
    },
    grid,
    scale,
  };
}

export interface MountOptions {
  onAgent: () => void;
  // A role title was clicked on the glass; the owner flips it and calls
  // setOpen.
  onToggle: (block: number) => void;
  // Play the power-on (dot, line, picture) before the boot screen, for a
  // return from agent mode.
  powerOn: boolean;
}

type Target =
  | { mode: "agent" }
  | { sound: true }
  | { link: number }
  | { section: number }
  | { game: true }
  | { day: ContributionDay; index: number };

const dayStatus = ({ count, date, weekday }: ContributionDay) =>
  `${date} ${WEEKDAYS[weekday] ?? ""} · ${count} ${count === 1 ? "CONTRIBUTION" : "CONTRIBUTIONS"}`;

const SCROLL_KEYS: Record<string, (page: number) => number> = {
  ArrowDown: () => 1,
  ArrowUp: () => -1,
  End: () => Number.POSITIVE_INFINITY,
  Home: () => Number.NEGATIVE_INFINITY,
  PageDown: (page) => page,
  PageUp: (page) => -page,
};

export class CrtController {
  private readonly glass: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly doc: ScreenDoc;
  private readonly onAgent: () => void;
  private readonly onToggle: (block: number) => void;
  private open: OpenRoles = new Set();
  private readonly renderer: CrtRenderer;
  private readonly text: HTMLCanvasElement;
  private readonly copy: HTMLElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly screen: Screen;
  private readonly state: ScreenState = {
    clock: clock(),
    cursorOn: true,
    scroll: 0,
    soundOn: soundEnabled(),
  };
  private readonly reducedMotion = matchMedia(
    "(prefers-reduced-motion: reduce)"
  );
  private readonly debug = new URLSearchParams(location.search).has("debug");
  private readonly teardown: (() => void)[] = [];
  private box = { h: 1, w: 1, x: 0, y: 0 };
  private radius = 0;
  private scale = 1;
  private dpr = 1;
  private dirty: boolean;
  private frameId = 0;
  private startedAt = 0;
  private frames = 0;
  private fpsSince = 0;
  private wheelRemainder = 0;
  private touchY: number | undefined;
  private booting: boolean;
  private bootAt = 0;
  private bootFullAt: number | undefined;
  private bootKey = "";
  private bootOks = 0;
  private offAt: number | undefined;
  private onAt: number | undefined;
  private readonly powerOn: boolean;
  private powerOnPlayed = false;
  private hoverSoundAt = 0;
  private readonly game = new SnakeGame();
  private gameHover = false;
  private wasPlaying = false;
  private dim = 0;
  private frameAt = 0;
  private portrait: HTMLImageElement | undefined;
  private readonly bootSteps: BootStep[] = [
    // mount() waits for the font before the controller exists.
    { done: true, file: "VGA8X16.FNT" },
    { done: false, file: "PORTRAIT.PIX" },
  ];

  private constructor(
    glass: HTMLElement,
    canvas: HTMLCanvasElement,
    copy: HTMLElement,
    gl: WebGL2RenderingContext,
    ctx: CanvasRenderingContext2D,
    doc: ScreenDoc,
    { onAgent, onToggle, powerOn }: MountOptions
  ) {
    this.glass = glass;
    this.onAgent = onAgent;
    this.onToggle = onToggle;
    this.powerOn = powerOn;
    this.canvas = canvas;
    this.copy = copy;
    this.text = ctx.canvas;
    this.dirty = true;
    this.booting = true;
    this.doc = doc;
    this.ctx = ctx;
    const { palette, tube } = readTokens();
    this.renderer = new CrtRenderer(gl, toRgb(palette.glass), toRgb(tube));
    ctx.font = `${CELL_H}px "${FONT_FAMILY}"`;
    this.screen = {
      ascent: Math.round(ctx.measureText("M").fontBoundingBoxAscent || 12),
      grid: { cols: 1, margin: 0, measure: 1, rows: 1 },
      layout: layoutDoc(doc, 1),
      palette,
      title: doc.title,
    };
  }

  // Resolves to null when WebGL2 or 2D canvas is unavailable, so the
  // caller keeps the HTML copy visible. A software renderer counts as
  // unavailable: it spends seconds of main thread on every shader frame.
  static async mount(
    glass: HTMLElement,
    canvas: HTMLCanvasElement,
    copy: HTMLElement,
    doc: ScreenDoc,
    options: MountOptions
  ): Promise<CrtController | null> {
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      failIfMajorPerformanceCaveat: true,
    });
    const ctx = document.createElement("canvas").getContext("2d");
    if (!(gl && ctx) || isSoftwareGl(gl)) {
      return null;
    }
    await document.fonts.load(`${CELL_H}px "${FONT_FAMILY}"`);
    const controller = new CrtController(
      glass,
      canvas,
      copy,
      gl,
      ctx,
      doc,
      options
    );
    controller.loadPortrait();
    controller.start();
    return controller;
  }

  private loadPortrait() {
    const image = new Image();
    const settle = (ok: boolean) => {
      this.portrait = ok ? image : undefined;
      for (const step of this.bootSteps) {
        step.done = true;
      }
      this.dirty = true;
    };
    image.addEventListener("load", () => settle(true), { once: true });
    image.addEventListener("error", () => settle(false), { once: true });
    image.src = PORTRAIT_URL;
  }

  private endBoot() {
    if (this.booting) {
      this.booting = false;
      this.dirty = true;
    }
  }

  // Progress never runs ahead of real loading. Under reduced motion the
  // bar jumps to whatever has loaded.
  private bootFrame(now: number, motion: boolean): BootFrame {
    const steps = this.bootSteps;
    const loaded = steps.filter((s) => s.done).length;
    const real = Math.floor((BOOT_CELLS * loaded) / steps.length);
    const timed = motion
      ? Math.floor(((now - this.bootAt) / BOOT_MS) * BOOT_CELLS) + 1
      : BOOT_CELLS;
    const filled = Math.max(0, Math.min(real, timed, BOOT_CELLS));
    const i = Math.min(
      steps.length - 1,
      Math.floor((filled * steps.length) / BOOT_CELLS)
    );
    const step = steps[i] ?? { done: true, file: "" };
    const stepOk = step.done && filled >= ((i + 1) * BOOT_CELLS) / steps.length;
    return { filled, step, stepOk };
  }

  // Each step that reads OK ticks; the full bar beeps instead.
  private bootSounds(frame: BootFrame) {
    const steps = this.bootSteps;
    const oks = steps.filter(
      (step, i) =>
        step.done && frame.filled >= ((i + 1) * BOOT_CELLS) / steps.length
    ).length;
    if (oks <= this.bootOks) {
      return;
    }
    this.bootOks = oks;
    play(frame.filled === BOOT_CELLS ? "beep" : "step");
  }

  private updateBoot(now: number, motion: boolean) {
    const frame = this.bootFrame(now, motion);
    this.bootSounds(frame);
    if (frame.filled === BOOT_CELLS) {
      this.bootFullAt ??= now;
      if (now - this.bootFullAt >= BOOT_HOLD_MS) {
        this.endBoot();
        return;
      }
    }
    const key = `${frame.filled} ${stepLine(frame)}`;
    if (key !== this.bootKey) {
      this.bootKey = key;
      this.dirty = true;
    }
    return frame;
  }

  // Plays the power-off collapse, then hands over to agent mode. Reduced
  // motion skips straight to the handover.
  powerOff() {
    if (this.offAt !== undefined) {
      return;
    }
    play("powerOff");
    if (this.reducedMotion.matches) {
      this.onAgent();
      return;
    }
    this.offAt = performance.now();
  }

  setOpen(open: OpenRoles) {
    this.open = open;
    const { grid } = this.screen;
    this.screen.layout = layoutDoc(this.doc, grid.measure, open);
    const lit = this.state.focus ?? this.state.hover;
    if (lit !== undefined) {
      this.state.status = linkStatus(this.screen.layout.links[lit]);
    }
    this.scrollTo(this.state.scroll);
    this.dirty = true;
  }

  dispose() {
    cancelAnimationFrame(this.frameId);
    for (const undo of this.teardown) {
      undo();
    }
  }

  private focusLink(id?: number) {
    this.endBoot();
    const link = id === undefined ? undefined : this.screen.layout.links[id];
    this.state.focus = id;
    this.state.status = linkStatus(link);
    if (link) {
      const visible = viewportRows(this.screen.grid);
      if (link.row < this.state.scroll) {
        this.scrollTo(link.row);
      } else if (link.row >= this.state.scroll + visible - 1) {
        this.scrollTo(link.row - visible + 3);
      }
    }
    this.dirty = true;
  }

  private start() {
    this.bindPointer();
    this.bindKeys();
    this.bindFocus();
    this.teardown.push(
      subscribeSound(() => {
        this.state.soundOn = soundEnabled();
        if (this.state.soundHover) {
          this.state.status = soundStatus();
        }
        this.dirty = true;
      })
    );
    const observer = new ResizeObserver(() => this.resize());
    observer.observe(this.glass);
    this.teardown.push(() => observer.disconnect());
    this.resize();
    this.startedAt = performance.now();
    this.bootAt = this.startedAt;
    if (this.powerOn && !this.reducedMotion.matches) {
      this.onAt = this.startedAt;
      this.bootAt += POWER_MS;
    }
    this.fpsSince = this.startedAt;
    this.frameId = requestAnimationFrame(this.tick);
  }

  private listen<K extends keyof WindowEventMap>(
    target: HTMLElement | Window,
    type: K,
    handler: (event: WindowEventMap[K]) => void,
    options?: AddEventListenerOptions
  ) {
    const listener = handler as EventListener;
    target.addEventListener(type, listener, options);
    this.teardown.push(() =>
      target.removeEventListener(type, listener, options)
    );
  }

  private resize() {
    const { width, height } = this.glass.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);
    this.radius = Number.parseFloat(
      getComputedStyle(this.glass).borderTopLeftRadius
    );
    const { box, grid, scale } = fitGrid(width, height);
    this.box = box;
    this.scale = scale;
    this.screen.grid = grid;
    this.screen.layout = layoutDoc(this.doc, grid.measure, this.open);
    this.text.width = grid.cols * CELL_W;
    this.text.height = grid.rows * CELL_H;
    this.scrollTo(this.state.scroll);
    // Full screen is entered from the panel, so it goes when the panel does.
    if (!this.gameRect()) {
      this.state.full = false;
    }
    this.sizeGame();
    this.dirty = true;
  }

  private gameRect() {
    const { grid, layout } = this.screen;
    return gameRect(grid, layout.sections.length, this.state.full ?? false);
  }

  private sizeGame() {
    const rect = this.gameRect();
    if (rect) {
      this.game.resize(
        (rect.cols * CELL_W) / rect.cell,
        (rect.rows * CELL_H) / rect.cell
      );
    }
  }

  // Reached only by the F key. The field changes size, so a game in
  // progress ends.
  private toggleFull() {
    this.state.full = !this.state.full;
    this.game.quit();
    this.sizeGame();
    this.dirty = true;
    play("tick");
  }

  private gameTargetAt(row: number, col: number): Target | undefined {
    const rect = this.gameRect();
    if (!rect) {
      return;
    }
    const inField =
      row >= rect.row &&
      row < rect.row + rect.rows &&
      col >= rect.col &&
      col < rect.col + rect.cols;
    return inField && !this.game.active ? { game: true } : undefined;
  }

  // True when the game took the key. A game on screen takes every key, so
  // none of them scrolls the dimmed page.
  private gameKey(event: KeyboardEvent) {
    if (!this.gameRect()) {
      return false;
    }
    const key = event.key.toLowerCase();
    if (this.game.active) {
      if (key === "escape") {
        this.game.quit();
      } else {
        this.game.turn(key);
      }
      return key !== "tab";
    }
    if (key === "g") {
      this.game.start();
      return true;
    }
    if (key === "f" || (key === "escape" && this.state.full)) {
      this.toggleFull();
      return true;
    }
    // The page is hidden in full screen; scrolling it would be invisible.
    return Boolean(this.state.full) && event.key in SCROLL_KEYS;
  }

  private playingStatus() {
    return this.game.playing
      ? `${PLAYING_STATUS}    SCORE ${scoreText(this.game.score)}`
      : undefined;
  }

  private updateGame(now: number, motion: boolean) {
    if (!this.gameRect()) {
      return;
    }
    if (this.game.update(now, motion)) {
      this.dirty = true;
    }
    // The score rides in the status bar, so it follows every point.
    const { playing } = this.game;
    const status = this.playingStatus();
    if (
      playing !== this.wasPlaying ||
      (playing && status !== this.state.status)
    ) {
      this.wasPlaying = playing;
      this.state.status = status;
      this.dirty = true;
    }
    const target = this.game.active ? 1 : 0;
    if (this.dim !== target) {
      const step = motion ? (now - this.frameAt) / DIM_MS : 1;
      this.dim =
        target > this.dim
          ? Math.min(1, this.dim + step)
          : Math.max(0, this.dim - step);
      this.dirty = true;
    }
  }

  private scrollTo(row: number) {
    const next = Math.min(maxScroll(this.screen), Math.max(0, row));
    if (next !== this.state.scroll) {
      this.state.scroll = next;
      this.dirty = true;
    }
  }

  private scrollByPixels(pixels: number) {
    const rowPx = CELL_H * this.scale;
    this.wheelRemainder += pixels;
    const rows = Math.trunc(this.wheelRemainder / rowPx);
    this.wheelRemainder -= rows * rowPx;
    this.scrollTo(this.state.scroll + rows);
  }

  // Pointer position -> the same barrel curve the shader samples with ->
  // font pixel on the text grid. No inverse transform needed.
  private gridPoint(clientX: number, clientY: number) {
    const rect = this.glass.getBoundingClientRect();
    const [u, v] = barrel(
      (clientX - rect.left) / rect.width,
      (clientY - rect.top) / rect.height,
      rect.width / rect.height
    );
    return {
      x: (u * rect.width - this.box.x) / this.scale,
      y: (v * rect.height - this.box.y) / this.scale,
    };
  }

  private targetAt(clientX: number, clientY: number): Target | undefined {
    if (this.booting || this.offAt !== undefined) {
      return;
    }
    const { x, y } = this.gridPoint(clientX, clientY);
    const col = Math.floor(x / CELL_W);
    const row = Math.floor(y / CELL_H);
    const { grid, layout } = this.screen;
    const toggle = modeSwitchCols(grid, this.state.clock);
    if (row === 0 && col >= toggle.start && col < toggle.end) {
      return { mode: "agent" };
    }
    const mute = soundSwitchCols(grid, this.state.clock);
    if (row === 0 && col >= mute.start && col < mute.end) {
      return { sound: true };
    }
    const game = this.gameTargetAt(row, col);
    // Behind a game or full screen, nothing else on the page responds.
    if (game || this.game.active || this.state.full) {
      return game;
    }
    const section = sectionAt(this.screen, row, col);
    if (section !== undefined) {
      return { section };
    }
    if (row < CONTENT_TOP || row >= CONTENT_TOP + viewportRows(grid)) {
      return;
    }
    const docRow = row - CONTENT_TOP + this.state.scroll;
    const link = linkAtCell(layout, docRow, col - grid.margin);
    if (link !== undefined) {
      return { link };
    }
    const docY = y + (this.state.scroll - CONTENT_TOP) * CELL_H;
    const hit = dayAt(layout, docY, col - grid.margin);
    if (!hit) {
      return;
    }
    const day = hit.graph.grid.days[hit.index];
    return day && { day, index: hit.index };
  }

  private statusFor(target?: Target) {
    if (!target) {
      return;
    }
    if ("mode" in target) {
      return AGENT_STATUS;
    }
    if ("sound" in target) {
      return soundStatus();
    }
    if ("link" in target) {
      return linkStatus(this.screen.layout.links[target.link]);
    }
    if ("section" in target) {
      const { label } = this.screen.layout.sections[target.section] ?? {};
      return `JUMP TO ${label ?? ""}`;
    }
    if ("game" in target) {
      return PLAY_STATUS;
    }
    return dayStatus(target.day);
  }

  private setHover(target?: Target) {
    const link = target && "link" in target ? target.link : undefined;
    const section = target && "section" in target ? target.section : undefined;
    const day = target && "day" in target ? target.index : undefined;
    const mode = target !== undefined && "mode" in target;
    const sound = target !== undefined && "sound" in target;
    const game = target !== undefined && "game" in target;
    const { state } = this;
    if (
      game === this.gameHover &&
      link === state.hover &&
      section === state.hoverSection &&
      day === state.day &&
      mode === Boolean(state.modeHover) &&
      sound === Boolean(state.soundHover)
    ) {
      return;
    }
    state.hover = link;
    state.hoverSection = section;
    state.day = day;
    state.modeHover = mode;
    state.soundHover = sound;
    this.gameHover = game;
    state.status = this.statusFor(target) ?? this.playingStatus();
    const clickable =
      link !== undefined || section !== undefined || game || mode || sound;
    this.canvas.style.cursor = clickable ? "pointer" : "default";
    this.dirty = true;
    // Only the pointer reaches here; keyboard focus stays silent.
    const now = performance.now();
    if (clickable && now - this.hoverSoundAt >= HOVER_SOUND_GAP_MS) {
      this.hoverSoundAt = now;
      play("hover");
    }
  }

  private activate(target?: Target) {
    if (!target || "day" in target) {
      return;
    }
    if ("mode" in target) {
      this.powerOff();
      return;
    }
    if ("sound" in target) {
      toggleSound();
      return;
    }
    if ("game" in target) {
      this.game.start();
      this.setHover(undefined);
      return;
    }
    play("tick");
    if ("section" in target) {
      this.scrollTo(sectionStops(this.screen)[target.section] ?? 0);
      return;
    }
    const link = this.screen.layout.links[target.link];
    if (link?.toggle) {
      this.onToggle(link.toggle.block);
      return;
    }
    const href = link?.href;
    if (href) {
      setTimeout(
        () => window.open(href, "_blank", "noopener,noreferrer"),
        LINK_OPEN_DELAY_MS
      );
    }
  }

  private bindPointer() {
    const { canvas } = this;
    this.listen(
      canvas,
      "wheel",
      (event) => {
        event.preventDefault();
        if (this.game.active || this.state.full) {
          return;
        }
        const lineMode = event.deltaMode === 1;
        this.scrollByPixels(
          lineMode ? event.deltaY * CELL_H * this.scale : event.deltaY
        );
      },
      { passive: false }
    );
    this.listen(canvas, "pointerdown", (event) => {
      this.touchY = event.pointerType === "touch" ? event.clientY : undefined;
    });
    this.listen(canvas, "pointermove", (event) => {
      if (event.pointerType === "touch" && this.touchY !== undefined) {
        this.scrollByPixels(this.touchY - event.clientY);
        this.touchY = event.clientY;
        return;
      }
      this.setHover(this.targetAt(event.clientX, event.clientY));
    });
    this.listen(canvas, "pointerup", () => {
      this.touchY = undefined;
    });
    this.listen(canvas, "pointerleave", () => this.setHover(undefined));
    this.listen(canvas, "click", (event) => {
      if (this.booting) {
        this.endBoot();
        return;
      }
      this.activate(this.targetAt(event.clientX, event.clientY));
    });
  }

  // Tab moves through the mode switch and the real links in the HTML
  // copy; the canvas shows whichever one has focus.
  private bindFocus() {
    const linkId = (target: EventTarget | null) => {
      const id =
        target instanceof HTMLElement ? target.dataset.link : undefined;
      return id === undefined ? undefined : Number(id);
    };
    // Unlike a link, the switch can hold focus through the boot screen: it
    // gets focus on the way back from agent mode, before this controller
    // exists.
    const focusSwitch = (target: EventTarget | null) => {
      const data = target instanceof HTMLElement ? target.dataset : undefined;
      const mode = data?.modeSwitch !== undefined;
      const sound = data?.soundSwitch !== undefined;
      this.state.modeHover = mode;
      this.state.soundHover = sound;
      if (mode) {
        this.state.status = AGENT_STATUS;
      } else {
        this.state.status = sound ? soundStatus() : undefined;
      }
      this.dirty = true;
      return mode || sound;
    };
    focusSwitch(document.activeElement);
    this.listen(this.copy, "focusin", (event) => {
      if (!focusSwitch(event.target)) {
        this.focusLink(linkId(event.target));
      }
    });
    // Links and role toggles in the copy work by keyboard, so they click
    // here too.
    this.listen(this.copy, "click", (event) => {
      if (
        event.target instanceof Element &&
        event.target.closest("a, [data-link]")
      ) {
        play("tick");
      }
    });
    this.listen(this.copy, "focusout", () => {
      this.state.modeHover = false;
      this.state.soundHover = false;
      this.focusLink(undefined);
    });
  }

  private bindKeys() {
    this.listen(window, "keydown", (event) => {
      // Any key skips the boot screen; Tab also moves focus as usual.
      if (this.booting && event.key !== "Tab") {
        this.endBoot();
        return;
      }
      const modified = event.altKey || event.ctrlKey || event.metaKey;
      if (modified || isTyping(event.target)) {
        return;
      }
      if (this.gameKey(event)) {
        event.preventDefault();
        this.dirty = true;
        return;
      }
      const move = SCROLL_KEYS[event.key];
      if (!move) {
        return;
      }
      event.preventDefault();
      const delta = move(viewportRows(this.screen.grid) - 1);
      if (delta === Number.POSITIVE_INFINITY) {
        this.scrollTo(maxScroll(this.screen));
      } else if (delta === Number.NEGATIVE_INFINITY) {
        this.scrollTo(0);
      } else {
        this.scrollTo(this.state.scroll + delta);
      }
    });
  }

  private updateClockAndCursor(now: number, motion: boolean) {
    const cursorOn = motion
      ? Math.floor((now - this.startedAt) / BLINK_MS) % 2 === 0
      : true;
    const time = clock();
    if (cursorOn !== this.state.cursorOn || time !== this.state.clock) {
      this.state.cursorOn = cursorOn;
      this.state.clock = time;
      this.dirty = true;
    }
  }

  private updateFps(now: number) {
    this.frames += 1;
    if (now - this.fpsSince < 1000) {
      return;
    }
    const { cols, rows } = this.screen.grid;
    this.state.status = `FPS ${this.frames}  ${cols}x${rows} @${this.scale}x  DPR ${this.dpr}`;
    this.frames = 0;
    this.fpsSince = now;
    this.dirty = true;
  }

  // 0 with the picture fully on, 1 fully dark. Power-on runs the power-off
  // backwards.
  private powerLevel(now: number) {
    if (this.offAt !== undefined) {
      return Math.min(1, (now - this.offAt) / POWER_MS);
    }
    if (this.onAt === undefined) {
      return 0;
    }
    const level = Math.max(0, 1 - (now - this.onAt) / POWER_MS);
    if (level === 0) {
      this.onAt = undefined;
    }
    return level;
  }

  private takeDirty() {
    const wasDirty = this.dirty;
    this.dirty = false;
    return wasDirty;
  }

  private readonly tick = (now: number) => {
    this.frameId = requestAnimationFrame(this.tick);
    const motion = !this.reducedMotion.matches;
    this.updateClockAndCursor(now, motion);
    if (this.debug) {
      this.updateFps(now);
    }

    // On the first frame rather than in start(): a controller disposed
    // straight after mounting never gets here.
    if (this.powerOn && !this.powerOnPlayed) {
      this.powerOnPlayed = true;
      play("powerOn");
    }
    const off = this.powerLevel(now);
    const boot = this.booting ? this.updateBoot(now, motion) : undefined;
    if (!boot) {
      this.updateGame(now, motion);
    }
    this.frameAt = now;
    const redraw = this.takeDirty();
    if (redraw) {
      const { screen } = this;
      if (boot) {
        drawBoot(
          this.ctx,
          screen.grid,
          screen.palette,
          screen.ascent,
          this.portrait,
          boot
        );
      } else {
        drawScreen(this.ctx, screen, this.state);
        const rect = this.gameRect();
        if (rect) {
          drawGame(this.ctx, screen, this.game, {
            dim: this.dim,
            full: this.state.full ?? false,
            hover: this.gameHover,
            rect,
          });
        }
      }
      this.renderer.upload(this.text);
    }
    // Under reduced motion the frame is static, so only redraw on change.
    if (redraw || motion || off > 0) {
      const { box, dpr } = this;
      this.renderer.render({
        content: [box.x * dpr, box.y * dpr, box.w * dpr, box.h * dpr],
        dpr,
        motion,
        off,
        radius: this.radius * dpr,
        time: (now - this.startedAt) / 1000,
      });
    }
    if (off === 1) {
      cancelAnimationFrame(this.frameId);
      this.onAgent();
    }
  };
}
