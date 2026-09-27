"use client";

import { useEffect, useRef } from "react";

type Tone = "heading" | "body" | "note";

const TONE_CLASS: Record<Tone, string> = {
  body: "",
  heading: "font-semibold text-phosphor",
  note: "text-phosphor-faint",
};

const LINK_CLASS =
  "rounded-sm underline decoration-phosphor-ghost underline-offset-4 hover:text-phosphor focus-visible:outline-2 focus-visible:outline-phosphor focus-visible:outline-offset-2";

// Groups the raw source into runs of lines that share a tone: headings are
// bright, everything after the closing rule is a footnote.
function toneRuns(markdown: string) {
  const runs: { offset: number; text: string; tone: Tone }[] = [];
  let offset = 0;
  let inNote = false;
  for (const line of markdown.split("\n")) {
    inNote ||= line === "---";
    let tone: Tone = "body";
    if (inNote) {
      tone = "note";
    } else if (line.startsWith("#")) {
      tone = "heading";
    }
    const last = runs.at(-1);
    if (last?.tone === tone) {
      last.text += `\n${line}`;
    } else {
      runs.push({ offset, text: last ? `\n${line}` : line, tone });
    }
    offset += line.length + 1;
  }
  return runs;
}

export function AgentView({
  focusSwitch,
  markdown,
  onHuman,
}: {
  // Switched to rather than loaded: focus follows the switch across.
  focusSwitch: boolean;
  markdown: string;
  onHuman: () => void;
}) {
  const switchRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (focusSwitch) {
      switchRef.current?.focus();
    }
  }, [focusSwitch]);

  return (
    <div className="min-h-dvh bg-tube font-agent text-phosphor-dim">
      <header className="sticky top-0 flex items-center justify-between gap-4 border-phosphor-ghost border-b bg-tube px-4 py-3 text-sm sm:px-6">
        <p className="flex min-w-0 flex-wrap gap-x-3">
          <span className="font-semibold text-phosphor">text/markdown</span>
          <span className="text-phosphor-faint">
            GET{" "}
            <a className={LINK_CLASS} href="/index.md">
              /index.md
            </a>{" "}
            · also{" "}
            <a className={LINK_CLASS} href="/llms.txt">
              /llms.txt
            </a>
          </span>
        </p>
        <button
          aria-checked="true"
          aria-label="Agent view"
          className="group flex shrink-0 items-center gap-3 rounded-sm text-xs tracking-[0.14em] focus-visible:outline-2 focus-visible:outline-phosphor focus-visible:outline-offset-4"
          onClick={onHuman}
          ref={switchRef}
          role="switch"
          type="button"
        >
          <span className="text-phosphor-faint group-hover:text-phosphor-dim">
            HUMAN
          </span>
          <span className="flex h-6 w-10 justify-end rounded-sm bg-black p-0.5 ring-1 ring-phosphor-ghost">
            <span className="w-1/2 rounded-[2px] bg-phosphor-ghost shadow-[inset_0_1px_0_var(--color-phosphor-faint)]" />
          </span>
          <span className="font-semibold text-phosphor">AGENT</span>
        </button>
      </header>
      <main className="px-4 py-10 sm:px-12 sm:py-14">
        <pre className="mx-auto max-w-3xl whitespace-pre-wrap break-words font-agent text-sm leading-6 sm:text-base sm:leading-7">
          {toneRuns(markdown).map((run) => (
            <span className={TONE_CLASS[run.tone]} key={run.offset}>
              {run.text}
            </span>
          ))}
        </pre>
      </main>
    </div>
  );
}
