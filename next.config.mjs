import createMDX from "@next/mdx";

const AGENT_VIEW = [{ key: "view", type: "query", value: "agent" }];
const WANTS_MARKDOWN = [
  { key: "accept", type: "header", value: "(.*)text/markdown(.*)" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  headers: () => [
    {
      // Markdown copies of the pages: readable by agents, kept out of
      // search results so they don't compete with them.
      headers: [{ key: "X-Robots-Tag", value: "noindex" }],
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
