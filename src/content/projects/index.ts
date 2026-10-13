import type { MDXContent } from "mdx/types";
import type { Block } from "@/crt/doc";
import { mdxBlocks } from "@/crt/mdx";

// Projects with a page of their own, in the order the home screen lists
// them. Each is src/content/projects/<slug>.mdx.
export const PROJECT_SLUGS = ["ditto", "rankmesh", "backpack", "quickvid"];

// The `metadata` export of a project's MDX file.
export interface ProjectMeta {
  // Meta description and the markdown summary line.
  description: string;
  // Right-aligned label on the home screen entry.
  kind: string;
  name: string;
  repo?: string;
  site?: string;
  // Body of the home screen entry.
  summary: string;
  // Page title.
  title: string;
}

export interface Project {
  blocks: Block[];
  meta: ProjectMeta;
  path: string;
  slug: string;
}

export async function loadProject(slug: string): Promise<Project> {
  const page: { default: MDXContent; metadata: ProjectMeta } = await import(
    `@/content/projects/${slug}.mdx`
  );
  return {
    blocks: mdxBlocks(page.default),
    meta: page.metadata,
    path: `/projects/${slug}`,
    slug,
  };
}

export const loadProjects = () => Promise.all(PROJECT_SLUGS.map(loadProject));
