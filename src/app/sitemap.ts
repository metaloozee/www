import type { MetadataRoute } from "next";
import { PROJECT_SLUGS } from "@/content/projects";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { changeFrequency: "weekly", priority: 1, url: SITE_URL },
    ...PROJECT_SLUGS.map((slug) => ({
      changeFrequency: "monthly" as const,
      priority: 0.8,
      url: `${SITE_URL}/projects/${slug}`,
    })),
  ];
}
