import type { Metadata } from "next";
import { SiteView } from "@/components/site-view";
import { loadProject, loadProjects, PROJECT_SLUGS } from "@/content/projects";
import { toMarkdown } from "@/crt/markdown";
import { projectDoc, projectMetadata } from "@/crt/project-doc";

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

// The agent view of a project page, served for /projects/<slug>?view=agent.
export default async function AgentProjectPage({ params }: Props) {
  const { slug } = await params;
  const projects = await loadProjects();
  const project = projects.find((p) => p.slug === slug) ?? projects[0];
  if (!project) {
    return null;
  }
  const doc = projectDoc(project, projects);
  return (
    <SiteView
      doc={doc}
      initialView="agent"
      markdown={toMarkdown(doc)}
      path={project.path}
    />
  );
}
