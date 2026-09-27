import type { ScreenDoc } from "./doc";

// Prototype content, mirroring the Paper home and projects boards.
// Replaced by content/index.md once the markdown pipeline lands.
export const SAMPLE_DOC: ScreenDoc = {
  blocks: [
    { kind: "prompt", text: "C:\\HOME> type about.txt" },
    { kind: "heading", section: "ABOUT", text: "HEY THERE, I'M AYAN." },
    {
      kind: "paragraph",
      spans: [
        {
          text: "Twenty-year-old programmer who can't stop poking at full-stack development and artificial intelligence. I started out designing graphics for e-sports teams; now I build agents, AI platforms and the web apps around them. Currently an AI Engineer Intern at ",
        },
        { href: "https://rankmesh.ai", text: "Rankmesh" },
        {
          text: ", and studying computer science at the University of Mumbai until 2027.",
        },
      ],
    },
    {
      kind: "facts",
      rows: [
        {
          label: "LOCATION",
          value: [
            {
              href: "https://en.wikipedia.org/wiki/Mumbai",
              text: "Mumbai, India",
            },
          ],
        },
        {
          label: "NOW",
          value: [
            {
              href: "https://rankmesh.ai",
              text: "AI Engineer Intern @ Rankmesh",
            },
          ],
        },
        {
          label: "STUDYING",
          value: [{ text: "B.Sc. Computer Science, class of 2027" }],
        },
      ],
    },
    { kind: "rule" },
    { kind: "prompt", text: "C:\\HOME> dir projects /w" },
    { kind: "heading", section: "PROJECTS", text: "PROJECTS" },
    {
      body: "An agent workspace for creating or importing React apps, chatting over code changes and iterating from idea to working app.",
      index: "01",
      kind: "entry",
      meta: "AI WORKSPACE",
      title: { href: "https://github.com/metaloozee/ditto", text: "DITTO" },
    },
    {
      body: "Self-hostable AI platform: 6+ LLM providers, RAG research spaces, cross-chat memory, MCP servers and a versioned artifact workspace.",
      index: "02",
      kind: "entry",
      meta: "AI PLATFORM",
      title: {
        href: "https://github.com/metaloozee/backpack",
        text: "BACKPACK",
      },
    },
    {
      body: "Summarise hour-long YouTube videos, check whether they hold up, and chat with them using the video's own context.",
      index: "03",
      kind: "entry",
      meta: "WEB APP",
      title: { href: "https://quickvid.vercel.app", text: "QUICKVID" },
    },
    { kind: "rule" },
    { kind: "prompt", text: "C:\\HOME> type contact.txt" },
    { kind: "heading", section: "CONTACT", text: "CONTACT" },
    {
      kind: "facts",
      rows: [
        {
          label: "X",
          value: [
            { href: "https://x.com/metaloozee", text: "x.com/metaloozee" },
          ],
        },
        {
          label: "GITHUB",
          value: [
            {
              href: "https://github.com/metaloozee",
              text: "github.com/metaloozee",
            },
          ],
        },
        {
          label: "LINKEDIN",
          value: [
            {
              href: "https://linkedin.com/in/ayanparkar",
              text: "linkedin.com/in/ayanparkar",
            },
          ],
        },
      ],
    },
  ],
  path: "C:\\HOME",
  title: "AYAN.SYS",
};
