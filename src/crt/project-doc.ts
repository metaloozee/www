import type { Metadata } from "next";
import type { Project } from "@/content/projects";
import { SITE_NAME } from "@/lib/site";
import type { Block, ScreenDoc } from "./doc";

// The home screen entry for a project, linking to its page.
export const projectEntry = (project: Project, index: number): Block => ({
  body: project.meta.summary,
  index: String(index + 1).padStart(2, "0"),
  kind: "entry",
  meta: project.meta.kind,
  title: { href: project.path, text: project.meta.name.toUpperCase() },
});

export const projectMetadata = ({ meta, path }: Project): Metadata => ({
  alternates: {
    canonical: path,
    types: { "text/markdown": `${path}/index.md` },
  },
  description: meta.description,
  openGraph: {
    description: meta.description,
    siteName: SITE_NAME,
    title: meta.title,
    type: "article",
    url: path,
  },
  title: { absolute: meta.title },
  twitter: {
    card: "summary_large_image",
    creator: "@metaloozee",
    description: meta.description,
    title: meta.title,
  },
});

const NON_FILENAME = /[^a-z0-9]+/g;
const fileName = (heading: string) =>
  heading.toLowerCase().replace(NON_FILENAME, "-");

// The shell every project page shares: a breadcrumb home, a DOS prompt
// before each section of the MDX body, and the other projects at the end.
export function projectDoc(project: Project, all: Project[]): ScreenDoc {
  const { meta, slug } = project;
  // Short enough for a phone's 39 columns: prompts do not wrap.
  const dir = "C:\\HOME>";
  const blocks: Block[] = [
    {
      kind: "paragraph",
      spans: [
        { href: "/", text: "← AYAN.WTF" },
        { text: ` \\ PROJECTS \\ ${meta.name.toUpperCase()}` },
      ],
    },
  ];
  for (const [i, block] of project.blocks.entries()) {
    if (block.kind === "heading") {
      if (i > 0) {
        blocks.push({ kind: "rule" });
      }
      const file = i === 0 ? `projects\\${slug}` : fileName(block.text);
      blocks.push({ kind: "prompt", text: `${dir} type ${file}.txt` });
    }
    blocks.push(block);
  }
  blocks.push(
    { kind: "rule" },
    { kind: "prompt", text: `${dir} dir projects /w` },
    { kind: "heading", section: "MORE PROJECTS", text: "MORE PROJECTS" },
    ...all.filter((other) => other.slug !== slug).map(projectEntry),
    { kind: "paragraph", spans: [{ href: "/", text: "← BACK TO AYAN.WTF" }] }
  );
  return {
    blocks,
    name: meta.name,
    summary: meta.description,
    title: "AYAN.WTF",
  };
}
