# Design

A personal site that runs on a simulated CRT monitor. Humans get the monitor. Agents get markdown.

Reference: the boot loader on shader.se. Take its glass, fringing and boot screen. Leave its blue: this site uses black glass and white P4 phosphor.

## Principles

1. **One source, two renderings.** `content/index.md` is the only copy of the content. The CRT and agent mode both render it. Nothing is written twice.
2. **Emphasis is brightness, not colour.** There is no accent hue. Hierarchy comes from phosphor intensity, inversion, and size.
3. **The glass is the effect.** Curvature, fringing, and bloom do the work. Scanlines and noise stay faint enough that nobody notices them on their own.
4. **Everything on screen snaps to the character grid.** No element sits between cells.

## Modes

| Mode | Default | What renders |
|---|---|---|
| Human | yes | Character-grid text drawn to a canvas, passed through the CRT shader |
| Agent | no | `index.md` as plain markdown, no shader, system mono font |

- A physical rocker switch on the bezel changes modes. Going to agent mode plays the power-off collapse (the picture squeezes to a horizontal line, then a dot, then fades). Going back plays the boot sequence.
- The choice is saved per visitor, with a fallback to Human.
- Agents that never click get the same content at `/index.md` and `/llms.txt`, and on `/` when the request sends `Accept: text/markdown`.

## Monitor body

A charcoal broadcast monitor (JVC-style), front-on, filling the window. There's no room or desk around it: on wide 16:9 screens an object floating in a room looks odd, so the casing is the page's edge.

- **Casing:** `--bezel` with a lit top edge (`--bezel-hi`) and a shaded bottom (`--bezel-lo`). Kept thin (about 1% of the window at the sides) so the glass gets most of the screen.
- **Bezel slope:** four border facets, lighter at the top, mid at the sides, darkest at the bottom, so the bezel reads as sloping down into the tube. The outer corner radius is the slope width plus `--opening`, so the opening itself has round corners; the tube, the glass and the shader's screen mask all share that radius.
- **Tube:** a `--tube` recess with an inner shadow around the glass.
- **Chin:** the `AYAN` logo, speaker grille, a recessed control strip (V-HOLD, BRIGHT, CONTRAST, SHARP), the Human/Agent rocker, the power LED and a round power button.
- **Sizing:** every thickness uses `clamp()` on the viewport, so the body keeps its proportions from a laptop up to a 16:9 display. Below `sm` the grille hides; below `md` the control keys hide and only the rocker and power stay.
- Styles live in `globals.css` under `@layer components` (`.crt-*`).

## Screen

The screen is a text-mode display: a fixed grid of character cells, like VGA text mode.

- **Cell:** 8×16 font pixels, drawn at an integer scale (`1×` below 640px of screen width, `2×` above). Never fractional.
- **Columns:** `floor(screenWidth / cellWidth)`, capped at 80. Content wraps to a 72-column measure with margins either side.
- **Rows:** fill the screen height. Content scrolls one row at a time inside the glass while the bezel stays still.
- **Layout units:** gaps, indents, and margins are whole numbers of cells. Section spacing is 2 rows.

## Colour

All tokens are OKLCH. P4 phosphor is slightly cool, so each step keeps a low chroma at hue 250.

| Token | Value | Use |
|---|---|---|
| `--bezel` | `oklch(0.20 0.003 250)` | Charcoal casing face (broadcast-monitor plastic) |
| `--bezel-hi` / `--bezel-lo` | `oklch(0.29 …)` / `oklch(0.12 …)` | Lit top edge and shaded bottom edge of the casing |
| `--facet-top` / `-side` / `-bottom` | `oklch(0.25 / 0.17 / 0.11 …)` | The bezel's slope into the tube, lit from above |
| `--tube` | `oklch(0.05 0 0)` | Recess between the slope and the glass; also what the shader shows past the curved screen |
| `--glass` | `oklch(0.14 0.004 250)` | Screen when unlit. Never pure black: the glass has a grey cast. |
| `--phosphor` | `oklch(0.94 0.012 250)` | Primary text, headings, active items |
| `--phosphor-dim` | `oklch(0.74 0.010 250)` | Body text |
| `--phosphor-faint` | `oklch(0.58 0.008 250)` | Metadata, dates, rules, hints |
| `--phosphor-ghost` | `oklch(0.26 0.006 250)` | Empty progress cells, disabled items |
| `--phosphor-hot` | `oklch(0.98 0.008 250)` | Overdriven phosphor with extra bloom. Level-4 contribution days only. |

- **Links:** `--phosphor` with an underline. Hover and focus invert the cells (glass-coloured text on a phosphor block).
- **Selection:** inverted cells.
- **Contrast:** check body text against `--glass` after bloom and vignette are applied, at the corners of the screen, where it's darkest. It must still pass 4.5:1 there.

## Type

- **Screen face:** Px437 IBM VGA 8×16 from the Ultimate Oldschool PC Font Pack (int10h.org), licensed CC BY-SA 4.0. Credit it in the agent-mode footer and in `/llms.txt`.
- **Sizes:** 1× for body, 2× (16×32 cells) for the name on the boot screen and for section headings. Nothing else.
- **Agent mode:** the platform monospace font. The bitmap font doesn't load there.
- Headings are uppercase. Body text keeps its case. No italics, since VGA text mode had none.

## Shader

A single fragment shader runs as a post-process over the canvas texture. Starting values, to tune against the reference:

| Effect | Value | Note |
|---|---|---|
| Barrel curvature | `k = 0.03` | Kept subtle on purpose (0.08 read as too much). Pixels past the curved screen show `--tube` |
| Screen corner radius | 4% of the short side | Rounded like the reference |
| Chromatic aberration | 0.5px at centre → 2.5px at edges | Red outward, cyan inward. This is the main signature of the effect. |
| Bloom | radius 6px, strength 0.35 | Soft halo around lit cells |
| Scanlines | 0.12 intensity, one per font pixel row | Should read as texture, not stripes |
| Vignette | 0.35 | Darkens toward the corners |
| Noise | 0.03, animated | Grain |
| Rolling band | 0.04 brightness, 9s period | A slow bright band drifting down |
| Flicker | ±0.5% luminance | |

**Reduced motion:** no noise animation, rolling band, or flicker; the boot sequence shows the finished frame immediately. Curvature, fringing, and bloom stay.

**Fallback when WebGL is missing:** the hidden DOM copy becomes visible and gets the colour tokens and VGA font, with no glass.

## Components

### GitHub contributions

The last year of activity from `github.com/metaloozee`, on the home screen under `C:\HOME> git log --graph --since=1.year`. Logic lives in `src/lib/github-contributions.ts`; the DOM fallback and accessible copy is `src/components/github-contributions.tsx`.

- **Grid:** each day is half a character cell (8×8 font pixels) drawing a 6×6 square, so a week is one column and 53 weeks fit in the 72-column measure.
- **Levels:** 0 ghost, 1 faint, 2 dim, 3 phosphor, 4 hot.
- **Month labels:** faint, one row above, dropped when fewer than 3 weeks from the next label.
- **Footer:** the total in dim, `GITHUB →` as a link (the VGA font has no ↗; use code-page-437 glyphs only), and a `LESS ▪▪▪▪▪ MORE` legend.
- **Hover and focus:** no floating tooltip. The hovered or focused day shows in the status bar (`2026-08-05 WED · 30 CONTRIBUTIONS`) and gets a hot outline. Once the graph has focus, arrow keys move between days.
- **Data:** fetched from the jogruber contributions API, revalidated daily. If it fails, show `ERROR: contribution data unavailable.` in faint.
- **Agent mode:** a two-line summary (total and busiest day), not the grid.

## Accessibility

The canvas is `aria-hidden`. A real DOM copy of `index.md` sits beside it, visually hidden, with the correct headings, links, and landmarks.

- Screen readers and find-in-page read the DOM copy.
- Tab moves focus through the real links in the DOM copy. The canvas draws an inverted block over the matching cells, and the page scrolls to keep it in view.
- Pointer hits are mapped through the inverse barrel transform to a cell, and from the cell to its link.
- Arrow keys and the page keys scroll the screen.

## Motion

| Moment | Behaviour | Duration |
|---|---|---|
| Boot | Warm-up glow, then a screen like the reference: name at 2×, version, progress bar, copyright line | About 1.8s; it waits on font and texture load, never on a fake timer |
| Progress bar | Fills one cell at a time; empty cells in `--phosphor-ghost` | Follows real loading progress |
| Power off | Collapse to a line, then a dot, then fade | 400ms |
| Scroll | Moves in whole rows. No smooth sub-row scrolling, since the grid is the point. | Instant |
| Cursor | Block cursor after the last line, blinking | 530ms on and off, as on a DOS PC |

## Stack

- Next.js (App Router) on Vercel.
- Tailwind v4 with the tokens above in `@theme`. It only styles the bezel, the switch, agent mode, and the fallback, because the screen itself is a canvas.
- shadcn with Base UI, restyled to the tokens, for the bezel switch and anything else interactive outside the canvas.
- Raw WebGL2 with one shader and no 3D library.
- Biome/Ultracite for linting.
