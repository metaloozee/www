import type { MDXContent } from "mdx/types";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import type { Block, Span } from "./doc";

// The screen is a canvas, so MDX is never rendered by React. Its element
// tree is read here into the blocks the CRT, the HTML copy and the
// markdown all draw from.

// Screenshots are exported 576 font pixels wide: the 72-column measure.
const FIGURE_WIDTH = 576;
const FIGURE_HEIGHT = 324;

interface FigureProps {
  alt: string;
  caption: string;
  // The full-size original the link opens. Not needed with `video`.
  full?: string;
  height?: number;
  // Copy at font-pixel resolution; the poster when there is a video.
  src: string;
  // A clip that plays on the screen in place of the picture.
  video?: string;
  width?: number;
}

// Marks a screenshot in MDX. Only its props are read.
export function Figure(_props: FigureProps) {
  return null;
}

const kids = (node: ReactNode): ReactNode[] => {
  if (Array.isArray(node)) {
    return node.flatMap(kids);
  }
  const drawable =
    typeof node === "string" ||
    typeof node === "number" ||
    isValidElement(node);
  return drawable ? [node] : [];
};

const childrenOf = (element: ReactElement) =>
  kids((element.props as { children?: ReactNode }).children);

const NEWLINES = /\s*\n\s*/g;

const plain = (node: ReactNode): string =>
  kids(node)
    .map((kid) => {
      if (isValidElement(kid)) {
        return plain(childrenOf(kid));
      }
      return String(kid).replace(NEWLINES, " ");
    })
    .join("");

// Inline content as spans: links keep their href, everything else is text.
function spans(nodes: ReactNode[]): Span[] {
  const out: Span[] = [];
  for (const node of nodes) {
    const isLink = isValidElement(node) && node.type === "a";
    const text = plain(node);
    const last = out.at(-1);
    if (isLink) {
      out.push({ href: (node.props as { href: string }).href, text });
    } else if (last && !last.href) {
      last.text += text;
    } else if (text) {
      out.push({ text });
    }
  }
  return out;
}

const isStrong = (node: ReactNode): node is ReactElement =>
  isValidElement(node) && node.type === "strong";

const LABEL_END = /:\s*$/;
const VALUE_START = /^[:\s]+/;

// "- **Stack:** Next.js" on every item makes the list a facts table.
function listBlock(list: ReactElement): Block {
  const items = childrenOf(list).filter(isValidElement).map(childrenOf);
  if (!items.every((item) => isStrong(item[0]))) {
    return { items: items.map(plain), kind: "list" };
  }
  return {
    kind: "facts",
    rows: items.map(([label, ...rest]) => {
      const value = spans(rest);
      const [first] = value;
      if (first && !first.href) {
        first.text = first.text.replace(VALUE_START, "");
      }
      return {
        label: plain(label).replace(LABEL_END, "").toUpperCase(),
        value: value.filter((span) => span.text),
      };
    }),
  };
}

function figureBlock(props: FigureProps): Block {
  return {
    alt: props.alt,
    caption: props.caption,
    height: props.height ?? FIGURE_HEIGHT,
    kind: "figure",
    link: props.video
      ? { href: props.video, text: "PLAY VIDEO" }
      : { href: props.full ?? props.src, text: "VIEW FULL SIZE" },
    src: props.src,
    video: props.video,
    width: props.width ?? FIGURE_WIDTH,
  };
}

function elementBlock(element: ReactElement): Block {
  switch (element.type) {
    case "h1":
      return {
        kind: "heading",
        section: "OVERVIEW",
        text: plain(element).toUpperCase(),
      };
    case "h2": {
      const text = plain(element).toUpperCase();
      return { kind: "heading", section: text, text };
    }
    case "p":
      return { kind: "paragraph", spans: spans(childrenOf(element)) };
    case "ul":
      return listBlock(element);
    case Figure:
      return figureBlock(element.props as FigureProps);
    default:
      // A build error beats content that silently never reaches the screen.
      throw new Error(`MDX element the screen cannot draw: ${element.type}`);
  }
}

export function mdxBlocks(Content: MDXContent): Block[] {
  const root: ReactNode = Content({});
  const top = isValidElement(root) && typeof root.type !== "string";
  return kids(top ? childrenOf(root) : root)
    .filter(isValidElement)
    .map(elementBlock);
}
