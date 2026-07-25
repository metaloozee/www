"use client";

import clsx from "clsx";
import { motion, useReducedMotion } from "framer-motion";
import { parseAsArrayOf, parseAsStringLiteral, useQueryState } from "nuqs";
import { type MouseEvent, useCallback, useEffect, useRef } from "react";

import MessageGroup, { MessageCard } from "@/components/message";
import { Button } from "@/components/ui/button";
import { INTRO_MESSAGES, SECTION_BUTTONS, SECTIONS } from "@/lib/content";

const sectionIds = SECTION_BUTTONS.map((s) => s.id);

export default function HomeContent() {
  const prefersReducedMotion = useReducedMotion();
  const scrollRef = useRef<HTMLUListElement>(null);

  const [activeSections, setActiveSections] = useQueryState(
    "sections",
    parseAsArrayOf(parseAsStringLiteral(sectionIds)).withDefault([])
  );

  useEffect(() => {
    if (activeSections.length > 0) {
      scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [activeSections.length]);

  const handleSectionClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const selectedSection = SECTION_BUTTONS.find(
        ({ id }) => id === event.currentTarget.name
      );

      if (!selectedSection) {
        return;
      }

      const sectionId = selectedSection.id;
      if (!activeSections.includes(sectionId)) {
        setActiveSections([...activeSections, sectionId]);
      }
    },
    [activeSections, setActiveSections]
  );

  const motionVariants = prefersReducedMotion
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : { delayChildren: 0.3, staggerChildren: 0.3 };

  const buttonMotionVariants = prefersReducedMotion
    ? { opacity: 1 }
    : { opacity: 1 };

  const buttonInitialVariants = prefersReducedMotion
    ? { opacity: 1 }
    : { opacity: 0 };

  return (
    <section className="container relative flex max-w-2xl flex-col items-center justify-center space-y-14 px-4 py-10">
      <h1 className="sr-only">Ayan - Full-Stack Developer & AI Enthusiast</h1>
      <motion.ul
        animate="show"
        className="space-y-10"
        initial="hidden"
        ref={scrollRef}
        transition={motionVariants}
      >
        <MessageGroup messages={INTRO_MESSAGES} />

        {activeSections.map((sectionId) => {
          const section = SECTIONS[sectionId];
          if (!section) {
            return null;
          }

          return (
            <div className="space-y-10" key={sectionId}>
              <MessageGroup messages={[section.userMessage]} user />
              <MessageGroup messages={section.response}>
                {section.projectCard && (
                  <MessageCard
                    description={section.projectCard.description}
                    footerUrl={section.projectCard.url}
                    title={section.projectCard.title}
                  />
                )}
              </MessageGroup>
            </div>
          );
        })}

        <motion.div
          animate={buttonMotionVariants}
          className="flex flex-wrap items-end justify-end gap-2"
          initial={buttonInitialVariants}
          transition={prefersReducedMotion ? {} : { delay: 1 }}
        >
          {SECTION_BUTTONS.map(({ id, label }) => {
            const isActive = activeSections.includes(id);
            return (
              <Button
                className={clsx("text-xs", isActive && "hidden")}
                disabled={isActive}
                key={id}
                name={id}
                onClick={handleSectionClick}
                variant="secondary"
              >
                {label}
              </Button>
            );
          })}
        </motion.div>
      </motion.ul>
    </section>
  );
}
