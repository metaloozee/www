export interface MessageData {
  content: string;
  key: string;
}

export interface ProjectCardData {
  description: string;
  title: string;
  url: string;
}

export interface SectionData {
  projectCard?: ProjectCardData;
  response: MessageData[];
  userMessage: MessageData;
}

export const INTRO_MESSAGES: MessageData[] = [
  {
    content: "hey there, im ayan",
    key: "intro",
  },
  {
    content:
      "im an [eighteen-year-old](https://en.wikipedia.org/wiki/January_29) programming enthusiast that is passionate about both full-stack-development and artificial-intelligence. my drive comes from a never-ending curiosity.",
    key: "short-about-me",
  },
  {
    content: "*p.s. want to know more about me? click on the buttons below*",
    key: "note",
  },
];

export const SECTIONS: Record<string, SectionData> = {
  about: {
    response: [
      {
        content:
          "I stand at the intersection of academia and innovation, an 18-year-old computer science student from [Mumbai, India](https://en.wikipedia.org/wiki/Mumbai). My journey in technology is as diverse as it is promising. I started my creative path in the vibrant world of [e-sports](https://en.wikipedia.org/wiki/Esports), where I expressed my flair by designing eye-catching graphics for teams and communities.",
        key: "about-1",
      },
      {
        content:
          "Now, with my sights set on the ever-expanding horizons of computer science, I'm carving out my niche in the realms of full-stack development and artificial intelligence. While pursuing my formal education in computer science, I'm not content with classroom learning alone. My insatiable curiosity drives me to delve deep into the foundations of AI, mastering complex subjects like [linear-algebra](https://en.wikipedia.org/wiki/Linear_algebra), [machine-learning](https://en.wikipedia.org/wiki/Machine_learning), and [deep-learning](https://en.wikipedia.org/wiki/Deep_learning).",
        key: "about-2",
      },
      {
        content:
          "With a solid foundation in design, a growing expertise in full-stack development, and a deepening understanding of AI, I'm not just preparing for the future of technology - I'm actively shaping it and I'm excited to see where my next \"big thing\" will take me as I continue to evolve, innovate, and inspire in the world of computer science and AI.",
        key: "about-3",
      },
    ],
    userMessage: {
      content: "tell me more about yourself",
      key: "about-user",
    },
  },
  contact: {
    response: [
      {
        content:
          "Intrigued to learn more about me? Or perhaps you have a professional opportunity in mind? Either way, you can connect with me through the following media:",
        key: "contact-1",
      },
      {
        content: `+ [x.com/metaloozee](https://x.com/metaloozee)
-----
+ [github.com/metaloozee](https://github.com/metaloozee)`,
        key: "contact-2",
      },
    ],
    userMessage: {
      content: "how can i reach out to you?",
      key: "contact-user",
    },
  },
  projects: {
    projectCard: {
      description:
        "QuickVid is an open sourced web application in which one can Summarize hour-long youtube videos, Verify the authenticity of the video and Chat with it based on the video's context.",
      title: "QuickVid",
      url: "https://quickvid.vercel.app/",
    },
    response: [
      {
        content:
          "My portfolio of software projects is diverse and extensive. I've developed everything from [Discord-bots](https://www.google.com/search?q=what+are+discord+bots) to [web-applications](https://en.wikipedia.org/wiki/Web_application), including one that was instrumental in my exam preparation.",
        key: "project-1",
      },
      {
        content:
          "While I continuously develop and release various projects in my spare time, I'm not entirely satisfied with all of them. However, there's one particular project that stands out and fills me with pride.",
        key: "project-2",
      },
    ],
    userMessage: {
      content: "what have you done in life?",
      key: "projects-user",
    },
  },
};

export const SECTION_BUTTONS = [
  { id: "about", label: "about-me" },
  { id: "projects", label: "what-have-i-done" },
  { id: "contact", label: "get-in-touch-with-me" },
] as const;

export type SectionId = (typeof SECTION_BUTTONS)[number]["id"];
