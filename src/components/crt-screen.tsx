"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CrtController } from "@/crt/controller";
import { type Block, collectLinks, type ScreenDoc, type Span } from "@/crt/doc";

export function CrtScreen({ doc }: { doc: ScreenDoc }) {
  const glassRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<CrtController | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const glass = glassRef.current;
    const canvas = canvasRef.current;
    const copy = copyRef.current;
    if (!(glass && canvas && copy)) {
      return;
    }
    let disposed = false;
    CrtController.mount(glass, canvas, copy, doc)
      .then((controller) => {
        if (disposed) {
          controller?.dispose();
          return;
        }
        controllerRef.current = controller;
        setLive(controller !== null);
      })
      .catch(() => setLive(false));
    return () => {
      disposed = true;
      controllerRef.current?.dispose();
      controllerRef.current = null;
    };
  }, [doc]);

  return (
    <main className="crt-casing">
      <div className="crt-bevel">
        <div className="crt-tube">
          <div className="crt-glass" ref={glassRef}>
            <canvas
              className={
                live ? "absolute inset-0 size-full touch-none" : "hidden"
              }
              ref={canvasRef}
            />
            <div
              className={
                live
                  ? "sr-only"
                  : "absolute inset-0 overflow-y-auto bg-glass p-6 font-screen text-phosphor-dim"
              }
              ref={copyRef}
            >
              <DocCopy doc={doc} />
            </div>
          </div>
        </div>
      </div>
      <BezelChin />
    </main>
  );
}

// Grille, control strip, rocker and power moulded into the casing.
// Decorative until the rocker becomes the Human/Agent mode switch.
function BezelChin() {
  return (
    <div aria-hidden="true" className="crt-chin">
      <span className="crt-logo">AYAN</span>
      <span className="crt-grille max-sm:hidden" />
      <div className="crt-strip">
        {["V-HOLD", "BRIGHT", "CONTRAST", "SHARP"].map((label) => (
          <span className="crt-key crt-silk max-md:hidden" key={label}>
            {label}
          </span>
        ))}
        <span className="flex items-center gap-3">
          <span className="crt-silk crt-silk-on">HUMAN</span>
          <span className="crt-rocker" />
          <span className="crt-silk">AGENT</span>
        </span>
      </div>
      <span className="flex items-center gap-3">
        <span className="crt-led" />
        <span className="crt-power" />
      </span>
    </div>
  );
}

type LinkIds = Map<Span, number>;

function Inline({ ids, span }: { ids: LinkIds; span: Span }) {
  const id = ids.get(span);
  if (!span.href || id === undefined) {
    return span.text;
  }
  return (
    <a
      className="text-phosphor underline"
      data-link={id}
      href={span.href}
      rel="noopener noreferrer"
      target="_blank"
    >
      {span.text}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

function Spans({ ids, spans }: { ids: LinkIds; spans: Span[] }) {
  return spans.map((span) => (
    <Inline ids={ids} key={`${span.text}-${span.href ?? ""}`} span={span} />
  ));
}

function BlockCopy({
  block,
  ids,
  isFirstHeading,
}: {
  block: Block;
  ids: LinkIds;
  isFirstHeading: boolean;
}) {
  switch (block.kind) {
    case "prompt":
      return (
        <p aria-hidden="true" className="text-phosphor-faint">
          {block.text}
        </p>
      );
    case "heading": {
      const Heading = isFirstHeading ? "h1" : "h2";
      return <Heading className="text-2xl text-phosphor">{block.text}</Heading>;
    }
    case "paragraph":
      return (
        <p>
          <Spans ids={ids} spans={block.spans} />
        </p>
      );
    case "facts":
      return (
        <dl className="grid grid-cols-[12ch_1fr]">
          {block.rows.map((row) => (
            <div className="contents" key={row.label}>
              <dt className="text-phosphor-faint">{row.label}</dt>
              <dd>
                <Spans ids={ids} spans={row.value} />
              </dd>
            </div>
          ))}
        </dl>
      );
    case "entry":
      return (
        <article>
          <h3>
            <Inline ids={ids} span={block.title} />
          </h3>
          <p className="text-phosphor-faint">{block.meta}</p>
          <p>{block.body}</p>
        </article>
      );
    case "rule":
      return <hr className="border-phosphor-faint" />;
    default:
      return null;
  }
}

// Real HTML for screen readers, find-in-page, keyboard focus and the
// no-WebGL fallback.
function DocCopy({ doc }: { doc: ScreenDoc }) {
  const ids = useMemo<LinkIds>(
    () => new Map(collectLinks(doc).map((span, i) => [span, i])),
    [doc]
  );
  const firstHeading = doc.blocks.findIndex((b) => b.kind === "heading");
  return (
    <div className="mx-auto flex max-w-[72ch] flex-col gap-4">
      {doc.blocks.map((block, i) => (
        <BlockCopy
          block={block}
          ids={ids}
          isFirstHeading={i === firstHeading}
          key={`${block.kind}-${i}`}
        />
      ))}
    </div>
  );
}
