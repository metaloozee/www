export const SITE_URL = "https://ayn.wtf";
export const SITE_NAME = "Ayan Parkar";
export const SITE_TITLE =
  "Ayan Parkar — AI Engineer & Full-Stack Developer, Mumbai";
export const SITE_DESCRIPTION =
  "Ayan Parkar (metaloozee) is an AI engineer and full-stack developer in Mumbai, building multi-agent systems at RankMesh and open-source AI apps like Backpack, Ditto and QuickVid.";

export const PROFILES = [
  "https://github.com/metaloozee",
  "https://linkedin.com/in/ayanparkar",
  "https://x.com/metaloozee",
];

// One canonical URL for both views; agents are pointed at the markdown.
export const HOME_ALTERNATES = {
  canonical: "/",
  types: { "text/markdown": "/index.md" },
};

// schema.org ProfilePage for the home page: ties the name to the handle
// and the profiles search engines already know.
export const PROFILE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  mainEntity: {
    "@id": `${SITE_URL}/#person`,
    "@type": "Person",
    address: {
      "@type": "PostalAddress",
      addressCountry: "IN",
      addressLocality: "Mumbai",
    },
    alternateName: "metaloozee",
    alumniOf: { "@type": "CollegeOrUniversity", name: "University of Mumbai" },
    description: SITE_DESCRIPTION,
    jobTitle: "AI Engineer Intern",
    knowsAbout: [
      "Multi-agent systems",
      "Retrieval-augmented generation",
      "Model Context Protocol",
      "LangChain",
      "TypeScript",
      "Next.js",
      "React",
      "Python",
      "FastAPI",
      "Cloudflare Workers",
    ],
    name: SITE_NAME,
    sameAs: PROFILES,
    url: SITE_URL,
    worksFor: {
      "@type": "Organization",
      name: "RankMesh",
      url: "https://rankmesh.ai",
    },
  },
  name: SITE_TITLE,
  url: SITE_URL,
};

const PERSON_REF = { "@id": `${SITE_URL}/#person`, name: SITE_NAME };

// schema.org for a project page: the page, its breadcrumb, and the
// repository when the project is open source.
export function projectJsonLd({
  meta,
  path,
}: {
  meta: { description: string; name: string; repo?: string; title: string };
  path: string;
}) {
  const url = `${SITE_URL}${path}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        author: PERSON_REF,
        breadcrumb: {
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              item: SITE_URL,
              name: SITE_NAME,
              position: 1,
            },
            { "@type": "ListItem", item: url, name: meta.name, position: 2 },
          ],
        },
        description: meta.description,
        name: meta.title,
        url,
      },
      ...(meta.repo
        ? [
            {
              "@type": "SoftwareSourceCode",
              author: PERSON_REF,
              codeRepository: meta.repo,
              description: meta.description,
              name: meta.name,
              url,
            },
          ]
        : []),
    ],
  };
}
