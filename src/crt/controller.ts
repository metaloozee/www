import type { ContributionDay } from "@/lib/github-contributions";
import {
  BOOT_CELLS,
  type BootFrame,
  type BootStep,
  drawBoot,
  stepLine,
} from "./boot";
import { isInternal, type OpenRoles, type ScreenDoc } from "./doc";
import {
  CELL_H,
  CELL_W,
  CONTENT_TOP,
  drawScreen,
  FONT_FAMILY,
  fullRect,
  type Grid,
  isPlaying,
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
import {
  dayAt,
  type FigureHit,
  figureAt,
  figureBySrc,
  layoutDoc,
  linkAtCell,
  type ScreenLink,
  transportAt,
} from "./layout";
import { barrel, CrtRenderer, type Rgb } from "./shader";
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
const soundStatus = () =>
  soundEnabled() ? "SOUND ON · CLICK TO MUTE" : "SOUND OFF · CLICK TO UNMUTE";
const linkStatus = (link?: ScreenLink) => {
  if (link?.toggle) {
    return link.toggle.open ? "COLLAPSE ROLE" : "EXPAND ROLE";
  }
  return link?.figure ? "ENTER FULL SCREEN" : link?.href;
};
// How long a screen with no page waits for the next page to take it over.
const HANDOVER_MS = 1000;
// One finger scrolls the page drawn here; a pinch is left to the browser.
const CANVAS_CLASS = "absolute inset-0 size-full touch-pinch-zoom";
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
  // The GPU dropped the picture; the owner shows the HTML copy and
  // releases the screen.
  onLost: () => void;
  // A link into this site was activated; the owner routes to it.
  onNavigate: (href: string) => void;
  // A role title was clicked on the glass; the owner flips it and calls
  // setOpen.
  onToggle: (block: number) => void;
  // Play the power-on (dot, line, picture) before the boot screen, for a
  // return from agent mode.
  powerOn: boolean;
}

// The boot plays once per page load, not again on each page of the site.
let booted = false;

// One screen outlives the page that mounted it. When a page unmounts, its
// controller waits here, still lit, and the next page adopts it: the
// picture changes in place instead of the glass going dark and rebooting.
let waiting: CrtController | undefined;
let running = 0;

// True while a screen is lit, so a page mounting next knows it has one to
// take over and need not show the HTML copy first.
export const crtRunning = () => running > 0;

type Target =
  | { mode: "agent" }
  | { sound: true }
  | { link: number }
  | { section: number }
  // Part of a figure: its picture, or a control in a clip's row.
  | FigureHit
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
  // The page-owned parts change when another page adopts the screen.
  private glass: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private doc: ScreenDoc;
  private onAgent: () => void;
  private onLost: () => void;
  private lost: boolean;
  private onToggle: (block: number) => void;
  private onNavigate: (href: string) => void;
  private open: OpenRoles = new Set();
  private readonly renderer: CrtRenderer;
  private readonly text: HTMLCanvasElement;
  private copy: HTMLElement;
  private handover = 0;
  private figureHover: string | undefined;
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
    { onAgent, onLost, onNavigate, onToggle, powerOn }: MountOptions
  ) {
    this.glass = glass;
    this.onAgent = onAgent;
    this.onLost = onLost;
    this.lost = false;
    this.onToggle = onToggle;
    this.onNavigate = onNavigate;
    this.powerOn = powerOn;
    this.canvas = canvas;
    this.copy = copy;
    this.text = ctx.canvas;
    this.dirty = true;
    this.booting = powerOn || !booted;
    this.doc = doc;
    this.ctx = ctx;
    const { palette, tube } = readTokens();
    this.renderer = new CrtRenderer(gl, toRgb(palette.glass), toRgb(tube));
    ctx.font = `${CELL_H}px "${FONT_FAMILY}"`;
    this.screen = {
      ascent: Math.round(ctx.measureText("M").fontBoundingBoxAscent || 12),
      grid: { cols: 1, margin: 0, measure: 1, rows: 1 },
      images: new Map(),
      layout: layoutDoc(doc, 1),
      palette,
      title: doc.title,
      videos: new Map(),
    };
  }

  // Resolves to null when WebGL2 or 2D canvas is unavailable, so the
  // caller keeps the HTML copy visible. A software renderer counts as
  // unavailable: it spends seconds of main thread on every shader frame.
  static async mount(
    glass: HTMLElement,
    host: HTMLElement,
    copy: HTMLElement,
    doc: ScreenDoc,
    options: MountOptions
  ): Promise<CrtController | null> {
    // Before any await, so a page that mounts in the same commit as the
    // last one unmounted takes the screen over before the next paint.
    const lit = waiting;
    waiting = undefined;
    if (lit && !options.powerOn) {
      lit.adopt(glass, host, copy, doc, options);
      return lit;
    }
    lit?.dispose();
    const canvas = document.createElement("canvas");
    canvas.className = CANVAS_CLASS;
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
    host.append(canvas);
    controller.loadPortrait();
    controller.loadFigures();
    controller.start();
    return controller;
  }

  // Takes the lit screen over for another page: new content, new
  // listeners, the same canvas and frame loop.
  private adopt(
    glass: HTMLElement,
    host: HTMLElement,
    copy: HTMLElement,
    doc: ScreenDoc,
    { onAgent, onLost, onNavigate, onToggle }: MountOptions
  ) {
    clearTimeout(this.handover);
    this.glass = glass;
    this.copy = copy;
    this.doc = doc;
    this.onAgent = onAgent;
    this.onLost = onLost;
    this.onNavigate = onNavigate;
    this.onToggle = onToggle;
    host.append(this.canvas);
    this.open = new Set();
    Object.assign(this.state, {
      day: undefined,
      focus: undefined,
      fullFigure: undefined,
      hover: undefined,
      hoverSection: undefined,
      modeHover: false,
      scroll: 0,
      soundHover: false,
      status: undefined,
    });
    this.figureHover = undefined;
    this.canvas.style.cursor = "default";
    this.screen.title = doc.title;
    this.screen.images = new Map();
    this.screen.videos = new Map();
    this.loadFigures();
    this.bind();
  }

  // The page is going away. The screen stays lit for the next page to
  // adopt; if none does, or the power-off already played, or the picture
  // is lost, it is disposed.
  release() {
    this.unbind();
    if (this.lost || this.offAt !== undefined) {
      this.dispose();
      return;
    }
    waiting?.dispose();
    waiting = this;
    this.handover = window.setTimeout(() => {
      if (waiting === this) {
        waiting = undefined;
      }
      this.dispose();
    }, HANDOVER_MS);
  }

  // A lost WebGL context draws nothing more. It is not restored: the page
  // falls back to its HTML copy, and the next page mounts a new screen.
  private readonly loseContext = () => {
    this.lost = true;
    cancelAnimationFrame(this.frameId);
    if (waiting === this) {
      waiting = undefined;
      this.dispose();
      return;
    }
    this.onLost();
  };

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

  // Pictures arrive after the text; each redraws the screen as it lands.
  // A clip is the <video> of the HTML copy, drawn here frame by frame.
  private loadFigures() {
    const redraw = () => {
      this.dirty = true;
    };
    for (const block of this.doc.blocks) {
      if (block.kind !== "figure") {
        continue;
      }
      const video = [...this.copy.querySelectorAll("video")].find(
        (candidate) => candidate.dataset.figure === block.src
      );
      if (video) {
        this.screen.videos.set(block.src, video);
        for (const type of ["play", "pause", "seeked", "loadeddata"] as const) {
          this.listen(video, type, redraw);
        }
      }
      const image = new Image();
      image.addEventListener(
        "load",
        () => {
          this.screen.images.set(block.src, image);
          this.dirty = true;
        },
        { once: true }
      );
      image.src = block.src;
    }
  }

  private endBoot() {
    if (this.booting) {
      booted = true;
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

  private unbind() {
    for (const undo of this.teardown.splice(0)) {
      undo();
    }
  }

  private dispose() {
    clearTimeout(this.handover);
    cancelAnimationFrame(this.frameId);
    this.unbind();
    this.canvas.remove();
    running -= 1;
  }

  private toggleVideo(src: string, seek?: number) {
    const video = this.screen.videos.get(src);
    if (!video) {
      return;
    }
    if (seek !== undefined && Number.isFinite(video.duration)) {
      video.currentTime = seek * video.duration;
    } else if (video.paused) {
      video.play().catch(() => {
        // Playback refused: the poster stays up.
      });
    } else {
      video.pause();
    }
    this.dirty = true;
  }

  // Gives a figure the whole screen, or hands the screen back to the
  // page. A picture swaps to its full-size file once that has loaded.
  private toggleFullFigure(src?: string) {
    const entering = this.state.fullFigure === undefined && src !== undefined;
    this.state.fullFigure = entering ? src : undefined;
    this.setHover(undefined);
    this.dirty = true;
    const full = src && figureBySrc(this.screen.layout, src)?.full;
    if (!(entering && full) || this.screen.images.has(full)) {
      return;
    }
    const image = new Image();
    image.addEventListener(
      "load",
      () => {
        this.screen.images.set(full, image);
        this.dirty = true;
      },
      { once: true }
    );
    image.src = full;
  }

  private figureStatus({ figure, part }: FigureHit) {
    if (part === "seek") {
      return "SEEK";
    }
    const full = this.state.fullFigure === undefined ? "ENTER" : "EXIT";
    if (part === "full" || !figure.video) {
      return `${full} FULL SCREEN`;
    }
    const video = this.screen.videos.get(figure.src);
    return video && isPlaying(video) ? "PAUSE VIDEO" : "PLAY VIDEO";
  }

  // The figure in full screen takes the keys: none of them scrolls the
  // hidden page.
  private figureKey(event: KeyboardEvent) {
    const src = this.state.fullFigure;
    const key = event.key.toLowerCase();
    if (src === undefined) {
      // F on a focused figure's control gives that figure the screen.
      const focused = this.screen.layout.links[this.state.focus ?? -1]?.figure;
      if (key === "f" && focused) {
        this.toggleFullFigure(focused);
        return true;
      }
      return false;
    }
    if (key === "escape" || key === "f") {
      this.toggleFullFigure();
    } else if (key === " " || key === "k") {
      this.toggleVideo(src);
    }
    return key !== "tab";
  }

  // Under the pointer while a figure has the screen: its picture and, for
  // a clip, its control row. A picture leaves full screen from anywhere.
  private fullTargetAt(row: number, col: number): Target | undefined {
    const { grid, layout } = this.screen;
    const figure = figureBySrc(layout, this.state.fullFigure ?? "");
    if (!figure) {
      return;
    }
    if (!figure.video) {
      return { figure, part: "picture" };
    }
    const rect = fullRect(grid, figure);
    const cols = Math.floor(rect.width / CELL_W);
    const pictureRows = Math.ceil(rect.height / CELL_H);
    const inCols = col >= rect.col && col < rect.col + cols;
    if (inCols && row >= rect.row && row < rect.row + pictureRows) {
      return { figure, part: "picture" };
    }
    const control =
      inCols && row === rect.row + pictureRows
        ? transportAt(cols, col - rect.col)
        : undefined;
    return control && { figure, ...control };
  }

  private focusLink(id?: number) {
    this.endBoot();
    const link = id === undefined ? undefined : this.screen.layout.links[id];
    this.state.focus = id;
    // Enter on a clip's control plays it rather than filling the screen.
    const clip = link?.figure && this.screen.videos.has(link.figure);
    this.state.status = clip
      ? "ENTER PLAY/PAUSE    F FULL SCREEN"
      : linkStatus(link);
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

  // Everything tied to the current page: listeners on its elements and
  // the size of its glass.
  private bind() {
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
    this.dirty = true;
  }

  private start() {
    running += 1;
    this.canvas.addEventListener("webglcontextlost", this.loseContext, {
      once: true,
    });
    this.bind();
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
    if (this.state.fullFigure !== undefined) {
      return this.fullTargetAt(row, col);
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
    const shown = figureAt(layout, docRow, col - grid.margin);
    if (shown) {
      return shown;
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
    if ("figure" in target) {
      return this.figureStatus(target);
    }
    return dayStatus(target.day);
  }

  private setHover(target?: Target) {
    const link = target && "link" in target ? target.link : undefined;
    const section = target && "section" in target ? target.section : undefined;
    const day = target && "day" in target ? target.index : undefined;
    const mode = target !== undefined && "mode" in target;
    const sound = target !== undefined && "sound" in target;
    const figure =
      target && "figure" in target
        ? `${target.figure.src} ${target.part}`
        : undefined;
    const { state } = this;
    if (
      figure === this.figureHover &&
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
    this.figureHover = figure;
    state.status = this.statusFor(target);
    const clickable =
      link !== undefined ||
      section !== undefined ||
      figure !== undefined ||
      mode ||
      sound;
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
    play("tick");
    if ("section" in target) {
      this.scrollTo(sectionStops(this.screen)[target.section] ?? 0);
      return;
    }
    if ("figure" in target) {
      const { figure, part, seek } = target;
      // A picture has one thing to do; a clip plays unless its
      // full-screen switch was the part clicked.
      if (part === "full" || !figure.video) {
        this.toggleFullFigure(figure.src);
      } else {
        this.toggleVideo(figure.src, seek);
        this.state.status = this.statusFor(target);
      }
      return;
    }
    const link = this.screen.layout.links[target.link];
    if (link?.toggle) {
      this.onToggle(link.toggle.block);
      return;
    }
    if (link?.figure) {
      this.toggleFullFigure(link.figure);
      return;
    }
    const href = link?.href;
    if (href && isInternal(href)) {
      this.onNavigate(href);
    } else if (href) {
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
        // Ctrl+wheel, and a trackpad pinch reported as one, zoom the page.
        if (event.ctrlKey) {
          return;
        }
        event.preventDefault();
        if (this.state.fullFigure !== undefined) {
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
      // A second finger starts a pinch, which must not scroll the page.
      const oneFinger = event.pointerType === "touch" && event.isPrimary;
      this.touchY = oneFinger ? event.clientY : undefined;
    });
    this.listen(canvas, "pointermove", (event) => {
      if (event.pointerType === "touch") {
        if (event.isPrimary && this.touchY !== undefined) {
          this.scrollByPixels(this.touchY - event.clientY);
          this.touchY = event.clientY;
        }
        return;
      }
      this.setHover(this.targetAt(event.clientX, event.clientY));
    });
    for (const type of ["pointerup", "pointercancel"] as const) {
      this.listen(canvas, type, () => {
        this.touchY = undefined;
      });
    }
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
      const control =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>("a, [data-link]")
          : null;
      if (!control) {
        return;
      }
      play("tick");
      // A picture's link opens the file where there is no screen; here
      // the picture takes the screen instead.
      const link = this.screen.layout.links[Number(control.dataset.link)];
      if (control instanceof HTMLAnchorElement && link?.figure) {
        event.preventDefault();
        this.toggleFullFigure(link.figure);
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
      if (this.figureKey(event)) {
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
    // A playing clip has a new frame, and a new position, every tick.
    for (const video of this.screen.videos.values()) {
      if (isPlaying(video)) {
        this.dirty = true;
      }
    }
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
