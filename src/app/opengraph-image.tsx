import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/site";

export const alt =
  "Ayan Parkar, AI engineer and full-stack developer in Mumbai";
export const size = { height: 630, width: 1200 };
export const contentType = "image/png";

// sRGB stand-ins for the DESIGN.md phosphor tokens; the renderer has no oklch.
const GLASS = "#090b0d";
const PHOSPHOR = "#eaeef3";
const DIM = "#aab0b8";
const FAINT = "#7b8189";

export default async function OpenGraphImage() {
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
      <div style={{ color: FAINT }}>C:\HOME&gt; type about.txt</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div
          style={{
            color: PHOSPHOR,
            fontSize: 128,
            textTransform: "uppercase",
          }}
        >
          {SITE_NAME}
        </div>
        <div style={{ fontSize: 48 }}>AI ENGINEER + FULL-STACK DEVELOPER</div>
        <div>MULTI-AGENT SYSTEMS · OPEN-SOURCE AI APPS · MUMBAI</div>
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
    { ...size, fonts: [{ data: font, name: "VGA", style: "normal" }] }
  );
}
