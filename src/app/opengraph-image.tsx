import { OG_SIZE, ogImage } from "@/lib/og";
import { SITE_NAME } from "@/lib/site";

export const alt =
  "Ayan Parkar, AI engineer and full-stack developer in Mumbai";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function OpenGraphImage() {
  return ogImage({
    prompt: "C:\\HOME> type about.txt",
    subtitle: "AI engineer + full-stack developer",
    tagline: "Multi-agent systems · open-source AI apps · Mumbai",
    title: SITE_NAME,
  });
}
