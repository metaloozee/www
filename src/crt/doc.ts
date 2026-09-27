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
  | { kind: "rule" };

export interface ScreenDoc {
  blocks: Block[];
  path: string;
  title: string;
}

// Links in reading order. The canvas and the hidden DOM copy both number
// links by position in this list, which is how focus stays in sync.
export function collectLinks(doc: ScreenDoc): Span[] {
  const spans: Span[] = [];
  for (const block of doc.blocks) {
    if (block.kind === "paragraph") {
      spans.push(...block.spans);
    } else if (block.kind === "facts") {
      for (const row of block.rows) {
        spans.push(...row.value);
      }
    } else if (block.kind === "entry") {
      spans.push(block.title);
    }
  }
  return spans.filter((span) => span.href);
}
