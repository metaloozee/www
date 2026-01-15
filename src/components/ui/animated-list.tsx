"use client";

import { AnimatePresence, type MotionProps, motion } from "framer-motion";
import {
  Children,
  type ComponentPropsWithoutRef,
  memo,
  type ReactElement,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

import { cn } from "@/lib/utils";

export function AnimatedListItem({ children }: { children: ReactNode }) {
  const animations: MotionProps = {
    initial: { scale: 0, opacity: 0 },
    animate: { scale: 1, opacity: 1, originY: 0 },
    exit: { scale: 0, opacity: 0 },
    transition: { type: "spring", stiffness: 350, damping: 40 },
  };

  return (
    <motion.div {...animations} className="mx-auto w-full" layout>
      {children}
    </motion.div>
  );
}

export interface AnimatedListProps extends ComponentPropsWithoutRef<"div"> {
  children: ReactNode;
  delay?: number;
}

export const AnimatedList = memo(
  ({ children, className, delay = 1000, ...props }: AnimatedListProps) => {
    const [visibleCount, setVisibleCount] = useState(1);
    const childrenArray = useMemo(() => Children.toArray(children), [children]);

    useEffect(() => {
      if (visibleCount < childrenArray.length) {
        const timeout = setTimeout(() => {
          setVisibleCount((prev) => prev + 1);
        }, delay);

        return () => clearTimeout(timeout);
      }
    }, [visibleCount, delay, childrenArray.length]);

    const itemsToShow = useMemo(() => {
      return childrenArray.slice(0, visibleCount);
    }, [visibleCount, childrenArray]);

    return (
      <div
        className={cn("flex flex-col items-center gap-4", className)}
        {...props}
      >
        <AnimatePresence>
          {itemsToShow.map((item) => (
            <AnimatedListItem key={(item as ReactElement).key}>
              {item}
            </AnimatedListItem>
          ))}
        </AnimatePresence>
      </div>
    );
  }
);

AnimatedList.displayName = "AnimatedList";
