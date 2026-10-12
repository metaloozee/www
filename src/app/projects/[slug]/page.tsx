import type { Metadata } from "next";
import { SiteView } from "@/components/site-view";
import { loadProject, loadProjects, PROJECT_SLUGS } from "@/content/projects";
import { toMarkdown } from "@/crt/markdown";
import { projectDoc, projectMetadata } from "@/crt/project-doc";
import { projectJsonLd } from "@/lib/site";

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = false;

export const generateStaticParams = () =>
  PROJECT_SLUGS.map((slug) => ({ slug }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return projectMetadata(await loadProject(slug));
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const projects = await loadProjects();
  const project = projects.find((p) => p.slug === slug) ?? projects[0];
  if (!project) {
    return null;
  }
  const doc = projectDoc(project, projects);
  // "<" is escaped so no string in the data can close the script element.
  const jsonLd = JSON.stringify(projectJsonLd(project)).replace(
    /</g,
    "\\u003c"
  );
  return (
    <>
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD must be raw; React would entity-escape it as text.
        dangerouslySetInnerHTML={{ __html: jsonLd }}
        type="application/ld+json"
      />
      <SiteView
        doc={doc}
        initialView="human"
        markdown={toMarkdown(doc)}
        path={project.path}
      />
    </>
  );
}
