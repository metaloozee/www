import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const OG_SIZE = { height: 630, width: 1200 };

// sRGB stand-ins for the DESIGN.md phosphor tokens; the renderer has no oklch.
const GLASS = "#090b0d";
const PHOSPHOR = "#eaeef3";
const DIM = "#aab0b8";
const FAINT = "#7b8189";

// The share card every page uses: a still of the screen, without the glass.
export async function ogImage({
  prompt,
  subtitle,
  tagline,
  title,
}: {
  prompt: string;
  subtitle: string;
  tagline: string;
  title: string;
}) {
  const font = await readFile(
    join(process.cwd(), "public/fonts/ibm-vga-8x16.woff")
  );
  return new ImageResponse(
    <div
      style={{
        backgroundColor: GLASS,
        color: DIM,
        display: "flex",
        flexDirection: "column",
        fontFamily: "VGA",
        fontSize: 32,
        height: "100%",
        justifyContent: "space-between",
        padding: 72,
        width: "100%",
      }}
    >
      <div style={{ color: FAINT }}>{prompt}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div
          style={{
            color: PHOSPHOR,
            fontSize: 128,
            textTransform: "uppercase",
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 48, textTransform: "uppercase" }}>
          {subtitle}
        </div>
        <div style={{ textTransform: "uppercase" }}>{tagline}</div>
      </div>
      <div
        style={{
          color: FAINT,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <div>AYN.WTF</div>
        <div>GITHUB.COM/METALOOZEE</div>
      </div>
    </div>,
    { ...OG_SIZE, fonts: [{ data: font, name: "VGA", style: "normal" }] }
  );
}
