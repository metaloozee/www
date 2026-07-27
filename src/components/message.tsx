"use client";

import clsx from "clsx";
import { motion, useReducedMotion } from "framer-motion";
import { Github, Globe, User } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import remarkGfm from "remark-gfm";

import { MemoizedReactMarkdown } from "@/components/markdown";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const groupVariant = {
  hidden: { opacity: 0, x: -5 },
  show: { opacity: 1, x: 0 },
};

const reducedGroupVariant = {
  hidden: { opacity: 1, x: 0 },
  show: { opacity: 1, x: 0 },
};

const itemVariant = {
  hidden: { opacity: 0 },
  show: { opacity: 1 },
};

const reducedItemVariant = {
  hidden: { opacity: 1 },
  show: { opacity: 1 },
};

export function MessageCard({
  title,
  description,
  footerUrl,
}: {
  title: string;
  description: string;
  footerUrl: string;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      transition={
        prefersReducedMotion
          ? {}
          : {
              damping: 100,
              mass: 1,
              stiffness: 500,
              type: "spring",
            }
      }
      variants={prefersReducedMotion ? reducedItemVariant : itemVariant}
    >
      <Card className="flex max-w-fit flex-col bg-zinc-900/50">
        <CardHeader>
          <CardTitle>{title.toLocaleLowerCase()}</CardTitle>
          <CardDescription>{description.toLocaleLowerCase()}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild className="w-full">
            <Link
              aria-label={`Visit ${title} website`}
              href={footerUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              {footerUrl.includes("github.com") ? (
                <Github aria-hidden="true" className="size-4" />
              ) : (
                <Globe aria-hidden="true" className="size-4" />
              )}
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}

function MessageBubble({
  content,
  prefersReducedMotion,
}: {
  content: string;
  prefersReducedMotion: boolean | null;
}) {
  return (
    <motion.div
      transition={
        prefersReducedMotion
          ? {}
          : {
              damping: 100,
              mass: 1,
              stiffness: 500,
              type: "spring",
            }
      }
      variants={prefersReducedMotion ? reducedItemVariant : itemVariant}
    >
      <Card className="flex max-w-fit flex-col bg-zinc-900/50">
        <CardHeader className="p-4 text-sm">
          <MemoizedReactMarkdown
            components={{
              a({ children, href }) {
                return (
                  <Link
                    className="bg-purple-50/10 text-purple-300"
                    href={href as string}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {children}
                  </Link>
                );
              },
              li({ children }) {
                return <li className="list-inside list-disc">{children}</li>;
              },
              ol({ children }) {
                return <ol className="list-item">{children}</ol>;
              },
              p({ children }) {
                return <p>{children}</p>;
              },
              ul({ children }) {
                return <ul className="list-item">{children}</ul>;
              },
            }}
            remarkPlugins={[remarkGfm]}
          >
            {content.toLocaleLowerCase()}
          </MemoizedReactMarkdown>
        </CardHeader>
      </Card>
    </motion.div>
  );
}

export default function MessageGroup({
  messages,
  user,
  children,
}: {
  messages?: Array<{ key: string; content: string }>;
  user?: boolean;
  children?: ReactNode;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.li
      className={clsx(
        "flex items-end justify-start gap-3 md:gap-5",
        user && "flex-row-reverse"
      )}
      transition={
        prefersReducedMotion
          ? {}
          : {
              damping: 140,
              mass: 11,
              staggerChildren: 0.1,
              stiffness: 500,
              type: "spring",
            }
      }
      variants={prefersReducedMotion ? reducedGroupVariant : groupVariant}
    >
      <Avatar>
        {!user && (
          <AvatarImage
            alt="Ayan's profile picture"
            src="https://github.com/metaloozee.png"
          />
        )}
        <AvatarFallback>
          <User aria-hidden="true" className="size-4" />
        </AvatarFallback>
      </Avatar>

      <div className="flex flex-col gap-2">
        {messages?.map(({ key: id, content }) => (
          <MessageBubble
            content={content}
            key={id}
            prefersReducedMotion={prefersReducedMotion}
          />
        ))}

        {children}
      </div>
    </motion.li>
  );
}
