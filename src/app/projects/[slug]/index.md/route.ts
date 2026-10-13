import { loadProjects, PROJECT_SLUGS } from "@/content/projects";
import { toMarkdown } from "@/crt/markdown";
import { projectDoc } from "@/crt/project-doc";

export const dynamicParams = false;

export const generateStaticParams = () =>
  PROJECT_SLUGS.map((slug) => ({ slug }));

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const projects = await loadProjects();
  const project = projects.find((p) => p.slug === slug);
  if (!project) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(toMarkdown(projectDoc(project, projects)), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
