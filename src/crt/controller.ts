import type { ContributionDay } from "@/lib/github-contributions";
import {
  BOOT_CELLS,
  type BootFrame,
  type BootStep,
  drawBoot,
  stepLine,
} from "./boot";
import type { ScreenDoc } from "./doc";
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
  viewportRows,
} from "./draw";
import { dayAt, layoutDoc, linkAtCell } from "./layout";
import { barrel, CrtRenderer, type Rgb } from "./shader";

const MEASURE = 72;
const MIN_MEASURE = 60;
const WIDE_SCREEN = 640;
const LARGE_SCREEN = 1920;
const BLINK_MS = 530;
const INDEX_WIDTH = 28;
const INDEX_GAP = 4;
const TYPING_TAGS = /^(INPUT|TEXTAREA|SELECT)$/;
const PORTRAIT_URL = "/boot/portrait.png";
// The bar fills over BOOT_MS unless loading is slower, then holds full.
const BOOT_MS = 1800;
const BOOT_HOLD_MS = 400;
const POWER_MS = 400;
const AGENT_STATUS = "SWITCH TO AGENT VIEW";
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

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || TYPING_TAGS.test(target.tagName));

// 1x cells on narrow glass, 1.5x (24px rows) on laptops and desktops, 2x
// on very wide glass. The shader's sharp-bilinear sampling keeps 1.5x
// crisp. The grid spans the glass less an edge kept clear of the curve;
// wide grids keep the INDEX column flush right and widen the prose to
// meet it.
function cellScale(width: number) {
  if (width >= LARGE_SCREEN) {
    return 2;
  }
  return width >= WIDE_SCREEN ? 1.5 : 1;
}

function fitGrid(width: number, height: number) {
  const scale = cellScale(width);
  const cellW = CELL_W * scale;
  const cellH = CELL_H * scale;
  const edgeCols = scale > 1 ? 5 : 3;
  const edgeY = 1.5 * cellH;
  const cols = Math.max(1, Math.floor(width / cellW) - 2 * edgeCols);
  const rows = Math.max(1, Math.floor((height - 2 * edgeY) / cellH));
  const indexMeasure = cols - INDEX_GAP - INDEX_WIDTH;
  const measure = Math.max(1, Math.min(MEASURE, cols - 2));
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
  // Play the power-on (dot, line, picture) before the boot screen, for a
  // return from agent mode.
  powerOn: boolean;
}

type Target =
  | { mode: "agent" }
  | { link: number }
  | { section: number }
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
  private readonly renderer: CrtRenderer;
  private readonly text: HTMLCanvasElement;
  private readonly copy: HTMLElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly screen: Screen;
  private readonly state: ScreenState = {
    clock: clock(),
    cursorOn: true,
    scroll: 0,
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
  private offAt: number | undefined;
  private onAt: number | undefined;
  private readonly powerOn: boolean;
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
    { onAgent, powerOn }: MountOptions
  ) {
    this.glass = glass;
    this.onAgent = onAgent;
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
  // caller keeps the HTML copy visible.
  static async mount(
    glass: HTMLElement,
    canvas: HTMLCanvasElement,
    copy: HTMLElement,
    doc: ScreenDoc,
    options: MountOptions
  ): Promise<CrtController | null> {
    const gl = canvas.getContext("webgl2", { alpha: false, antialias: false });
    const ctx = document.createElement("canvas").getContext("2d");
    if (!(gl && ctx)) {
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

  private updateBoot(now: number, motion: boolean) {
    const frame = this.bootFrame(now, motion);
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
    if (this.reducedMotion.matches) {
      this.onAgent();
      return;
    }
    this.offAt = performance.now();
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
    this.state.status = link?.href;
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
    this.screen.layout = layoutDoc(this.doc, grid.measure);
    this.text.width = grid.cols * CELL_W;
    this.text.height = grid.rows * CELL_H;
    this.scrollTo(this.state.scroll);
    this.dirty = true;
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
      (clientY - rect.top) / rect.height
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
    if ("link" in target) {
      return this.screen.layout.links[target.link]?.href;
    }
    if ("section" in target) {
      const { label } = this.screen.layout.sections[target.section] ?? {};
      return `JUMP TO ${label ?? ""}`;
    }
    return dayStatus(target.day);
  }

  private setHover(target?: Target) {
    const link = target && "link" in target ? target.link : undefined;
    const section = target && "section" in target ? target.section : undefined;
    const day = target && "day" in target ? target.index : undefined;
    const mode = target !== undefined && "mode" in target;
    const { state } = this;
    if (
      link === state.hover &&
      section === state.hoverSection &&
      day === state.day &&
      mode === Boolean(state.modeHover)
    ) {
      return;
    }
    state.hover = link;
    state.hoverSection = section;
    state.day = day;
    state.modeHover = mode;
    state.status = this.statusFor(target);
    const clickable = link !== undefined || section !== undefined || mode;
    this.canvas.style.cursor = clickable ? "pointer" : "default";
    this.dirty = true;
  }

  private activate(target?: Target) {
    if (!target || "day" in target) {
      return;
    }
    if ("mode" in target) {
      this.powerOff();
      return;
    }
    if ("section" in target) {
      this.scrollTo(this.screen.layout.sections[target.section]?.row ?? 0);
      return;
    }
    const href = this.screen.layout.links[target.link]?.href;
    if (href) {
      window.open(href, "_blank", "noopener,noreferrer");
    }
  }

  private bindPointer() {
    const { canvas } = this;
    this.listen(
      canvas,
      "wheel",
      (event) => {
        event.preventDefault();
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
      const on =
        target instanceof HTMLElement &&
        target.dataset.modeSwitch !== undefined;
      this.state.modeHover = on;
      this.state.status = on ? AGENT_STATUS : undefined;
      this.dirty = true;
      return on;
    };
    focusSwitch(document.activeElement);
    this.listen(this.copy, "focusin", (event) => {
      if (!focusSwitch(event.target)) {
        this.focusLink(linkId(event.target));
      }
    });
    this.listen(this.copy, "focusout", () => {
      this.state.modeHover = false;
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
      const move = SCROLL_KEYS[event.key];
      const modified = event.altKey || event.ctrlKey || event.metaKey;
      if (!move || modified || isTyping(event.target)) {
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

    const off = this.powerLevel(now);
    const boot = this.booting ? this.updateBoot(now, motion) : undefined;
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
