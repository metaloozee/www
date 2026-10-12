/** @type {import('next').NextConfig} */
const nextConfig = {
  headers: () => [
    {
      // Markdown copies of the home page: readable by agents, kept out of
      // search results so they don't compete with it.
      headers: [{ key: "X-Robots-Tag", value: "noindex" }],
      source: "/:file(index\\.md|llms\\.txt)",
    },
  ],
  // Both run before the static home page is matched, so it stays cacheable.
  rewrites: () => ({
    beforeFiles: [
      {
        destination: "/agent",
        has: [{ key: "view", type: "query", value: "agent" }],
        source: "/",
      },
      {
        destination: "/index.md",
        has: [
          { key: "accept", type: "header", value: "(.*)text/markdown(.*)" },
        ],
        source: "/",
      },
    ],
  }),
};

export default nextConfig;
