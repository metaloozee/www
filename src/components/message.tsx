"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { Globe, User } from "lucide-react";
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
const itemVariant = {
  hidden: { opacity: 0 },
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
  return (
    <motion.div
      className="group"
      transition={{
        type: "spring",
        mass: 1,
        damping: 100,
        stiffness: 500,
      }}
      variants={itemVariant}
      whileHover={{ scale: 1.02 }}
    >
      <Card className="flex max-w-fit flex-col border-zinc-800/60 bg-zinc-900/60 shadow-black/20 shadow-xl backdrop-blur-md transition-all duration-300 group-hover:border-purple-500/20 group-hover:shadow-purple-900/10">
        <CardHeader>
          <CardTitle className="text-zinc-100">
            {title.toLocaleLowerCase()}
          </CardTitle>
          <CardDescription className="text-zinc-400">
            {description.toLocaleLowerCase()}
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild className="w-full">
            <Link href={footerUrl} rel="noopener noreferrer" target="_blank">
              <Globe className="size-4" />
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}

function MessageBubble({ content }: { content: string }) {
  return (
    <motion.div
      className="group"
      transition={{
        type: "spring",
        mass: 1,
        damping: 100,
        stiffness: 500,
      }}
      variants={itemVariant}
    >
      <Card className="flex max-w-fit flex-col border-zinc-800/60 bg-zinc-900/60 shadow-black/15 shadow-lg backdrop-blur-md transition-all duration-300 group-hover:border-zinc-700/80 group-hover:shadow-xl">
        <CardHeader className="p-4 text-sm leading-relaxed">
          <MemoizedReactMarkdown
            components={{
              li({ children }) {
                return <li className="list-inside list-disc">{children}</li>;
              },
              ul({ children }) {
                return <ul className="list-item">{children}</ul>;
              },
              ol({ children }) {
                return <ol className="list-item">{children}</ol>;
              },
              p({ children }) {
                return <p className="text-zinc-200">{children}</p>;
              },
              a({ children, href }) {
                return (
                  <Link
                    className="rounded-sm bg-purple-500/15 px-1 py-0.5 text-purple-300 transition-all duration-200 hover:bg-purple-500/25 hover:text-purple-200"
                    href={href as string}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {children}
                  </Link>
                );
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
  return (
    <motion.li
      className={clsx(
        "flex items-end justify-start gap-3 md:gap-5",
        user && "flex-row-reverse"
      )}
      transition={{
        type: "spring",
        mass: 11,
        damping: 140,
        stiffness: 500,

        staggerChildren: 0.1,
      }}
      variants={groupVariant}
    >
      <Avatar>
        {!user && <AvatarImage src="https://github.com/metaloozee.png" />}
        <AvatarFallback>
          <User className="size-4" />
        </AvatarFallback>
      </Avatar>

      <div className="flex flex-col gap-2">
        {messages?.map(({ key: id, content }) => (
          <MessageBubble content={content} key={id} />
        ))}

        {children}
      </div>
    </motion.li>
  );
}
