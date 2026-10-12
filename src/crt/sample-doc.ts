import {
  type ContributionGrid,
  getContributions,
  toContributionGrid,
} from "@/lib/github-contributions";
import type { ScreenDoc } from "./doc";

export const GITHUB_USER = "metaloozee";
const PROFILE_URL = `https://github.com/${GITHUB_USER}`;

// Site content, kept in step with the Notion portfolio.
// Replaced by content/index.md once the markdown pipeline lands.
export const sampleDoc = (contributions: ContributionGrid): ScreenDoc => ({
  blocks: [
    { kind: "prompt", text: "C:\\HOME> type about.txt" },
    {
      kind: "heading",
      section: "ABOUT",
      text: "HEY THERE, I'M AYAN.",
    },
    {
      kind: "paragraph",
      spans: [
        {
          text: "I'm Ayan Parkar, a final-year computer engineering student in Mumbai and an AI Engineer Intern at RankMesh, where I work on multi-agent systems in production. I've been coding since 2020: I started out designing graphics for e-sports teams, got hooked building Spades, a Discord security bot that reached 100+ servers and 100K+ users, and now ship full-stack products, open-source fixes and public AI apps.",
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
              text: "AI Engineer Intern @ RankMesh",
            },
          ],
        },
        {
          label: "STUDYING",
          value: [
            {
              text: "B.E. Computer Engineering, University of Mumbai, class of 2027",
            },
          ],
        },
      ],
    },
    { kind: "prompt", text: "C:\\HOME> git log --graph --since=1.year" },
    {
      grid: contributions,
      kind: "contributions",
      link: { href: PROFILE_URL, text: "GITHUB →" },
    },
    { kind: "rule" },
    { kind: "prompt", text: "C:\\HOME> dir projects /w" },
    {
      kind: "heading",
      section: "PROJECTS",
      text: "PROJECTS",
    },
    {
      body: "A durable AI coding workspace on the web. Each GitHub repo gets its own sandbox with parallel sessions: isolated git worktrees, resumable agent runs over SSE, and a real commit-to-PR workflow shared by agents and humans. Built on TanStack Start and Cloudflare Workers, D1 and R2. Still in active development.",
      index: "01",
      kind: "entry",
      meta: "AI WORKSPACE",
      title: { href: "https://github.com/metaloozee/ditto", text: "DITTO" },
    },
    {
      body: "An autonomous SEO and AI-search visibility engine: agents audit, fix, write and publish while people review and approve. Multi-service FastAPI backend, Celery/Redis jobs with Claude and Codex runners, and a Next.js panel. This is what I ship day to day.",
      index: "02",
      kind: "entry",
      meta: "SEO + GEO AGENTS",
      title: { href: "https://rankmesh.ai", text: "RANKMESH" },
    },
    {
      body: "Self-hostable, open-source AI research and chat app in the spirit of NotebookLM: 6+ LLM providers, RAG research spaces, cross-chat memory, configurable MCP servers, web and academic search, and a versioned artifact workspace.",
      index: "03",
      kind: "entry",
      meta: "AI RESEARCH APP",
      title: {
        href: "https://github.com/metaloozee/backpack",
        text: "BACKPACK",
      },
    },
    {
      body: "Summarise, verify and chat with any YouTube video using transcripts, Gemini and RAG. Featured by LangChain, with 173 GitHub stars and 100+ active users before YouTube's crawler blocking made it unsustainable.",
      index: "04",
      kind: "entry",
      meta: "WEB APP",
      title: {
        href: "https://github.com/metaloozee/quickvid",
        text: "QUICKVID",
      },
    },
    {
      body: "College event management for registration, attendance, winners and automatic certificates, built to replace Google Forms and handwritten certificates. Won first prize and was adopted by the college.",
      index: "05",
      kind: "entry",
      meta: "EVENT PLATFORM",
      title: {
        href: "https://github.com/metaloozee/certify",
        text: "CERTIFY",
      },
    },
    {
      body: "Diploma capstone: a Google Classroom-style learning platform with AI personalization. Third prize at college.",
      index: "06",
      kind: "entry",
      meta: "LEARNING APP",
      title: {
        href: "https://github.com/metaloozee/learnify",
        text: "LEARNIFY",
      },
    },
    { kind: "rule" },
    { kind: "prompt", text: "C:\\HOME> type experience.log" },
    {
      kind: "heading",
      section: "EXPERIENCE",
      text: "EXPERIENCE",
    },
    {
      bullets: [
        "Shipped across the FastAPI multi-service backend: auth, ingestion and RAG routing, SEO and marketing workflows, scheduling, credits and billing.",
        "Built and hardened Celery/Redis autonomous execution with Claude and Codex runners, capacity leases and manager pause/resume/cancel.",
        "Owned large slices of the Next.js panel rewrite: client and manager workspaces, Meshy project chat over SSE, and the performance work for data-heavy polls.",
        "Wired Search Console, Analytics, Firecrawl, CMS and GitHub publish gates, R2 storage and review-first content release.",
      ],
      dates: "May 2026 – now",
      kind: "role",
      lead: [
        { href: "https://rankmesh.ai", text: "rankmesh.ai" },
        {
          text: " is an autonomous SEO and GEO engine: agents audit, fix, write and publish; humans review and approve.",
        },
      ],
      place: "Remote",
      title: { text: "AI Engineer Intern @ Ocavior (RankMesh)" },
    },
    {
      bullets: [
        "Built a marketing site and admin dashboard with Astro, TanStack Router and Cloudflare for a platform with 500,000+ monthly visitors.",
        "Added signed URL delivery, referer hotlink protection and image optimization to cut bandwidth waste and unauthorized reuse.",
      ],
      dates: "Apr 2026 – May 2026",
      kind: "role",
      place: "Norway, remote",
      title: { text: "Freelance Full-Stack Developer @ SBK Base" },
    },
    {
      bullets: [
        "Built a responsive educational site for The Deep Dive with jQuery and Shopify, for interactive deep-sea learning content.",
      ],
      dates: "Dec 2024 – Mar 2025",
      kind: "role",
      place: "Mumbai",
      title: { text: "Web Developer Intern @ Luma World" },
    },
    { kind: "rule" },
    { kind: "prompt", text: "C:\\HOME> git log --merges --author=ayan" },
    {
      kind: "heading",
      section: "OPEN SOURCE",
      text: "OPEN SOURCE",
    },
    {
      body: "Fixed an infinite auth redirect caused by stale React Query auth state in Umami, the 37k-star web analytics platform. Merged as PR #3706.",
      index: "01",
      kind: "entry",
      meta: "MERGED",
      title: {
        href: "https://github.com/umami-software/umami/pull/3706",
        text: "UMAMI",
      },
    },
    {
      body: "Fixed a browser crash when integration attachment fields weren't strings in Rocket.Chat, the 45k-star team chat platform. Merged as PR #39273.",
      index: "02",
      kind: "entry",
      meta: "MERGED",
      title: {
        href: "https://github.com/RocketChat/Rocket.Chat/pull/39273",
        text: "ROCKET.CHAT",
      },
    },
    { kind: "rule" },
    { kind: "prompt", text: "C:\\HOME> type skills.txt" },
    {
      kind: "heading",
      section: "SKILLS",
      text: "SKILLS",
    },
    {
      kind: "facts",
      rows: [
        {
          label: "LANGUAGES",
          value: [{ text: "TypeScript, JavaScript, Python, SQL, C/C++" }],
        },
        {
          label: "FRONTEND",
          value: [
            {
              text: "React, Next.js, Astro, TanStack Router and Query, Tailwind CSS, Vite",
            },
          ],
        },
        {
          label: "BACKEND",
          value: [
            {
              text: "Node.js, FastAPI, Django, REST APIs, Celery, Cloudflare Workers and D1, Docker, Vercel, CI/CD",
            },
          ],
        },
        {
          label: "AI + DATA",
          value: [
            {
              text: "LangChain, Vercel AI SDK, RAG, embeddings, semantic search, multi-agent systems, MCP, PostgreSQL, Supabase, Redis, Pinecone",
            },
          ],
        },
      ],
    },
    { kind: "rule" },
    { kind: "prompt", text: "C:\\HOME> type contact.txt" },
    {
      kind: "heading",
      section: "CONTACT",
      text: "CONTACT",
    },
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
              href: PROFILE_URL,
              text: `github.com/${GITHUB_USER}`,
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
  name: "Ayan Parkar",
  summary:
    "AI engineer and full-stack developer from Mumbai, India. Builds multi-agent systems, open-source AI apps and the web products around them.",
  title: "AYAN.WTF",
});

export const loadDoc = async () =>
  sampleDoc(toContributionGrid(await getContributions(GITHUB_USER)));
