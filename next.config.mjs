import createMDX from "@next/mdx";

const AGENT_VIEW = [{ key: "view", type: "query", value: "agent" }];
const WANTS_MARKDOWN = [
  { key: "accept", type: "header", value: "(.*)text/markdown(.*)" },
];

// These URLs answer with HTML or markdown depending on Accept, so a
// shared cache must key on it. Next adds its own Vary fields to the
// markdown answer; on a prerendered page under `next start` it replaces
// the header, and this one is lost.
const NEGOTIATED = [{ key: "Vary", value: "Accept" }];

// Markdown copies stay out of search results so they don't compete with
// the pages.
const NOINDEX = [{ key: "X-Robots-Tag", value: "noindex" }];

/** @type {import('next').NextConfig} */
const nextConfig = {
  headers: () => [
    { headers: NEGOTIATED, source: "/" },
    { headers: NEGOTIATED, source: "/projects/:slug" },
    {
      // The same markdown, asked for with Accept on the page's own URL.
      has: WANTS_MARKDOWN,
      headers: NOINDEX,
      source: "/",
    },
    {
      has: WANTS_MARKDOWN,
      headers: NOINDEX,
      source: "/projects/:slug",
    },
    {
      // Markdown copies of the pages, readable by agents.
      headers: NOINDEX,
      source: "/:path*/:file(index\\.md|llms\\.txt)",
    },
  ],
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  // All run before the static pages are matched, so those stay cacheable.
  rewrites: () => ({
    beforeFiles: [
      { destination: "/agent", has: AGENT_VIEW, source: "/" },
      { destination: "/index.md", has: WANTS_MARKDOWN, source: "/" },
      {
        destination: "/agent/projects/:slug",
        has: AGENT_VIEW,
        source: "/projects/:slug",
      },
      {
        destination: "/projects/:slug/index.md",
        has: WANTS_MARKDOWN,
        source: "/projects/:slug",
      },
    ],
  }),
};

export default createMDX()(nextConfig);
