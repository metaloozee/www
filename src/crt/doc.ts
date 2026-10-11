import type { ContributionGrid } from "@/lib/github-contributions";

export interface Span {
  href?: string;
  text: string;
}

export type Block =
  | { kind: "prompt"; text: string }
  // `section` names the heading in the INDEX column.
  | { kind: "heading"; section?: string; text: string }
  | { kind: "paragraph"; spans: Span[] }
  | { kind: "facts"; rows: { label: string; value: Span[] }[] }
  | { kind: "entry"; index: string; title: Span; meta: string; body: string }
  // A collapsible job. The title is the toggle, so it is a focus target
  // like a link; lead and bullets show only while the role is open.
  | {
      kind: "role";
      title: Span;
      dates: string;
      place: string;
      lead?: Span[];
      bullets: string[];
    }
  | { kind: "contributions"; grid: ContributionGrid; link: Span }
  | { kind: "rule" };

// Open roles, by index into `blocks`.
export type OpenRoles = ReadonlySet<number>;

export interface ScreenDoc {
  blocks: Block[];
  // Heading and one-line summary for the agent-mode markdown.
  name: string;
  summary: string;
  title: string;
}

// Links and role toggles in reading order. The canvas and the hidden DOM
// copy both number them by position in this list, which is how focus stays
// in sync. A closed role keeps its links in the list so the numbers hold.
export function collectLinks(doc: ScreenDoc): Span[] {
  const spans: Span[] = [];
  const add = (...found: Span[]) =>
    spans.push(...found.filter((span) => span.href));
  for (const block of doc.blocks) {
    if (block.kind === "paragraph") {
      add(...block.spans);
    } else if (block.kind === "facts") {
      for (const row of block.rows) {
        add(...row.value);
      }
    } else if (block.kind === "entry") {
      add(block.title);
    } else if (block.kind === "role") {
      spans.push(block.title);
      add(...(block.lead ?? []));
    } else if (block.kind === "contributions" && block.grid.days.length > 0) {
      add(block.link);
    }
  }
  return spans;
}
