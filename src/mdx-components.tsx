import type { MDXComponents } from "mdx/types";
import { Figure } from "@/crt/mdx";

// Components every MDX file can use without importing them.
export function useMDXComponents(): MDXComponents {
  return { Figure };
}
