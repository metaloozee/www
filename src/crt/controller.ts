import type { ScreenDoc } from "./doc";
import {
  CELL_H,
  CELL_W,
  CONTENT_TOP,
  drawScreen,
  FONT_FAMILY,
  type Grid,
  maxScroll,
  type Palette,
  type Screen,
  type ScreenState,
  sectionAt,
  viewportRows,
} from "./draw";
import { layoutDoc, linkAtCell } from "./layout";
import { barrel, CrtRenderer, type Rgb } from "./shader";

const MEASURE = 72;
const WIDE_SCREEN = 640;
const BLINK_MS = 530;
const INDEX_WIDTH = 16;
const INDEX_GAP = 6;
const TYPING_TAGS = /^(INPUT|TEXTAREA|SELECT)$/;

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

// Integer cell scale only: 1x on narrow glass, 2x otherwise. The grid
// spans the glass (less a small edge kept clear of the curve); prose stays
// at the reading measure, and wide screens add the INDEX column beside it.
function fitGrid(width: number, height: number) {
  const scale = width >= WIDE_SCREEN ? 2 : 1;
  const cellW = CELL_W * scale;
  const cellH = CELL_H * scale;
  const edge = scale === 2 ? 2 : 1;
  const cols = Math.floor(width / cellW) - 2 * edge;
  const rows = Math.floor(height / cellH) - 2;
  const measure = Math.min(MEASURE, cols - 2);
  const hasIndex = cols >= measure + INDEX_GAP + INDEX_WIDTH + 4;
  const grid: Grid = hasIndex
    ? {
        cols,
        index: { col: cols - INDEX_WIDTH - 2, width: INDEX_WIDTH },
        margin: 2,
        measure,
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

type Target = { link: number } | { section: number };

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

  private constructor(
    glass: HTMLElement,
    canvas: HTMLCanvasElement,
    copy: HTMLElement,
    gl: WebGL2RenderingContext,
    ctx: CanvasRenderingContext2D,
    doc: ScreenDoc
  ) {
    this.glass = glass;
    this.canvas = canvas;
    this.copy = copy;
    this.text = ctx.canvas;
    this.dirty = true;
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
      path: doc.path,
      title: doc.title,
    };
  }

  // Resolves to null when WebGL2 or 2D canvas is unavailable, so the
  // caller keeps the HTML copy visible.
  static async mount(
    glass: HTMLElement,
    canvas: HTMLCanvasElement,
    copy: HTMLElement,
    doc: ScreenDoc
  ): Promise<CrtController | null> {
    const gl = canvas.getContext("webgl2", { alpha: false, antialias: false });
    const ctx = document.createElement("canvas").getContext("2d");
    if (!(gl && ctx)) {
      return null;
    }
    await document.fonts.load(`${CELL_H}px "${FONT_FAMILY}"`);
    const controller = new CrtController(glass, canvas, copy, gl, ctx, doc);
    controller.start();
    return controller;
  }

  dispose() {
    cancelAnimationFrame(this.frameId);
    for (const undo of this.teardown) {
      undo();
    }
  }

  private focusLink(id?: number) {
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
  // text cell. No inverse transform needed.
  private cellAt(clientX: number, clientY: number) {
    const rect = this.glass.getBoundingClientRect();
    const [u, v] = barrel(
      (clientX - rect.left) / rect.width,
      (clientY - rect.top) / rect.height
    );
    return {
      col: Math.floor((u * rect.width - this.box.x) / (CELL_W * this.scale)),
      row: Math.floor((v * rect.height - this.box.y) / (CELL_H * this.scale)),
    };
  }

  private targetAt(clientX: number, clientY: number): Target | undefined {
    const { col, row } = this.cellAt(clientX, clientY);
    const { grid, layout } = this.screen;
    const section = sectionAt(this.screen, row, col);
    if (section !== undefined) {
      return { section };
    }
    if (row < CONTENT_TOP || row >= CONTENT_TOP + viewportRows(grid)) {
      return;
    }
    const docRow = row - CONTENT_TOP + this.state.scroll;
    const link = linkAtCell(layout, docRow, col - grid.margin);
    return link === undefined ? undefined : { link };
  }

  private statusFor(link?: number, section?: number) {
    if (link !== undefined) {
      return this.screen.layout.links[link]?.href;
    }
    if (section !== undefined) {
      return `JUMP TO ${this.screen.layout.sections[section]?.label ?? ""}`;
    }
  }

  private setHover(target?: Target) {
    const link = target && "link" in target ? target.link : undefined;
    const section = target && "section" in target ? target.section : undefined;
    if (link === this.state.hover && section === this.state.hoverSection) {
      return;
    }
    this.state.hover = link;
    this.state.hoverSection = section;
    this.state.status = this.statusFor(link, section);
    this.canvas.style.cursor = target ? "pointer" : "default";
    this.dirty = true;
  }

  private activate(target?: Target) {
    if (target && "section" in target) {
      this.scrollTo(this.screen.layout.sections[target.section]?.row ?? 0);
      return;
    }
    const href = target
      ? this.screen.layout.links[target.link]?.href
      : undefined;
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
    this.listen(canvas, "click", (event) =>
      this.activate(this.targetAt(event.clientX, event.clientY))
    );
  }

  // Tab moves through the real links in the HTML copy; the canvas shows
  // whichever one has focus.
  private bindFocus() {
    const linkId = (target: EventTarget | null) => {
      const id =
        target instanceof HTMLElement ? target.dataset.link : undefined;
      return id === undefined ? undefined : Number(id);
    };
    this.listen(this.copy, "focusin", (event) =>
      this.focusLink(linkId(event.target))
    );
    this.listen(this.copy, "focusout", () => this.focusLink(undefined));
  }

  private bindKeys() {
    this.listen(window, "keydown", (event) => {
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

    const redraw = this.takeDirty();
    if (redraw) {
      drawScreen(this.ctx, this.screen, this.state);
      this.renderer.upload(this.text);
    }
    // Under reduced motion the frame is static, so only redraw on change.
    if (redraw || motion) {
      const { box, dpr } = this;
      this.renderer.render({
        content: [box.x * dpr, box.y * dpr, box.w * dpr, box.h * dpr],
        dpr,
        motion,
        radius: this.radius * dpr,
        time: (now - this.startedAt) / 1000,
      });
    }
  };
}
