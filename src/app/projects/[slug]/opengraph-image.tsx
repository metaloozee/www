import { loadProject, PROJECT_SLUGS } from "@/content/projects";
import { OG_SIZE, ogImage } from "@/lib/og";
import { SITE_NAME } from "@/lib/site";

export const alt = "Project by Ayan Parkar";
export const size = OG_SIZE;
export const contentType = "image/png";

export const generateStaticParams = () =>
  PROJECT_SLUGS.map((slug) => ({ slug }));

export default async function ProjectOpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { meta } = await loadProject(slug);
  return ogImage({
    prompt: `C:\\HOME> type projects\\${slug}.txt`,
    subtitle: meta.kind,
    tagline: `A project by ${SITE_NAME}`,
    title: meta.name,
  });
}
