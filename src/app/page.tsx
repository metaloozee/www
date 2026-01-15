"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import MessageGroup, { MessageCard } from "@/components/message";
import { AnimatedList } from "@/components/ui/animated-list";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function IndexPage() {
  const [aboutMe, setAboutMe] = useState(false);
  const [projects, setProjects] = useState(false);
  const [contact, setContact] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (aboutMe || projects || contact) {
      // Use double rAF to ensure DOM has rendered before scrolling
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "end",
          });
        });
      });
    }
  }, [aboutMe, projects, contact]);

  return (
    <section className="container relative flex min-h-screen max-w-2xl flex-col items-center justify-center px-4 py-16">
      <AnimatedList className="w-full gap-10" delay={800}>
        <MessageGroup
          key="intro"
          messages={[
            {
              key: "intro",
              content: "hey there, im ayan",
            },
            {
              key: "short-about-me",
              content:
                "im an [eighteen-year-old](https://en.wikipedia.org/wiki/January_29) programming enthusiast that is passionate about both full-stack-development and artificial-intelligence. my drive comes from a never-ending curiosity.",
            },
            {
              key: "note",
              content:
                "*p.s. want to know more about me? click on the buttons below :3*",
            },
          ]}
        />

        {aboutMe && (
          <MessageGroup
            key="about-user"
            messages={[
              {
                key: "about",
                content: "tell me more about yourself",
              },
            ]}
            user
          />
        )}

        {aboutMe && (
          <MessageGroup
            key="about-response"
            messages={[
              {
                key: "about-1",
                content:
                  "I stand at the intersection of academia and innovation, an 18-year-old computer science student from [Mumbai, India](https://en.wikipedia.org/wiki/Mumbai). My journey in technology is as diverse as it is promising. I started my creative path in the vibrant world of [e-sports](https://en.wikipedia.org/wiki/Esports), where I expressed my flair by designing eye-catching graphics for teams and communities.",
              },
              {
                key: "about-2",
                content:
                  "Now, with my sights set on the ever-expanding horizons of computer science, I'm carving out my niche in the realms of full-stack development and artificial intelligence. While pursuing my formal education in computer science, I'm not content with classroom learning alone. My insatiable curiosity drives me to delve deep into the foundations of AI, mastering complex subjects like [linear-algebra](https://en.wikipedia.org/wiki/Linear_algebra), [machine-learning](https://en.wikipedia.org/wiki/Machine_learning), and [deep-learning](https://en.wikipedia.org/wiki/Deep_learning).",
              },
              {
                key: "about-3",
                content:
                  "With a solid foundation in design, a growing expertise in full-stack development, and a deepening understanding of AI, I'm not just preparing for the future of technology - I'm actively shaping it and I'm excited to see where my next \"big thing\" will take me as I continue to evolve, innovate, and inspire in the world of computer science and AI.",
              },
            ]}
          />
        )}

        {projects && (
          <MessageGroup
            key="projects-user"
            messages={[
              {
                key: "projects",
                content: "what have you done in life?",
              },
            ]}
            user
          />
        )}

        {projects && (
          <MessageGroup
            key="projects-response"
            messages={[
              {
                key: "project-1",
                content:
                  "My portfolio of software projects is diverse and extensive. I've developed everything from [Discord-bots](https://www.google.com/search?q=what+are+discord+bots) to [web-applications](https://en.wikipedia.org/wiki/Web_application), including one that was instrumental in my exam preparation.",
              },
              {
                key: "project-2",
                content:
                  "While I continuously develop and release various projects in my spare time, I'm not entirely satisfied with all of them. However, there's one particular project that stands out and fills me with pride.",
              },
            ]}
          >
            <MessageCard
              description="QuickVid is an open sourced web application in which one can Summarize hour-long youtube videos, Verify the authenticity of the video and Chat with it based on the video's context."
              footerUrl="https://quickvid.vercel.app/"
              title="QuickVid"
            />
          </MessageGroup>
        )}

        {contact && (
          <MessageGroup
            key="contact-user"
            messages={[
              {
                key: "contact",
                content: "how can i reach out to you?",
              },
            ]}
            user
          />
        )}

        {contact && (
          <MessageGroup
            key="contact-response"
            messages={[
              {
                key: "contact-1",
                content:
                  "Intrigued to learn more about me? Or perhaps you have a professional opportunity in mind? Either way, you can connect with me through the following media:",
              },
              {
                key: "contact-2",
                content: `+ [x.com/metaloozee](https://x.com/metaloozee)
-----
+ [github.com/metaloozee](https://github.com/metaloozee)`,
              },
            ]}
          />
        )}

        <motion.div
          animate={{ opacity: 1 }}
          className="flex flex-wrap items-end justify-end gap-3"
          initial={{ opacity: 0 }}
          key="buttons"
          transition={{ delay: 0.5 }}
        >
          <Button
            className={cn(
              "text-xs shadow-black/10 shadow-lg",
              aboutMe && "hidden"
            )}
            disabled={aboutMe}
            onClick={() => setAboutMe(true)}
            variant="secondary"
          >
            about-me
          </Button>
          <Button
            className={cn(
              "text-xs shadow-black/10 shadow-lg",
              projects && "hidden"
            )}
            disabled={projects}
            onClick={() => setProjects(true)}
            variant="secondary"
          >
            what-have-i-done
          </Button>
          <Button
            className={cn(
              "text-xs shadow-black/10 shadow-lg",
              contact && "hidden"
            )}
            disabled={contact}
            onClick={() => setContact(true)}
            variant="secondary"
          >
            get-in-touch-with-me
          </Button>
        </motion.div>
      </AnimatedList>
      <div ref={scrollRef} />
    </section>
  );
}
