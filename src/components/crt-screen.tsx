"use client";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { GitHubContributions } from "@/components/github-contributions";
import { CrtController } from "@/crt/controller";
import { type Block, collectLinks, type ScreenDoc, type Span } from "@/crt/doc";
import {
  serverSoundEnabled,
  soundEnabled,
  subscribeSound,
  toggleSound,
} from "@/crt/sound";

interface CrtScreenProps {
  doc: ScreenDoc;
  onAgent: () => void;
  // Mounted by a switch back from agent mode: play the power-on and give
  // the mode switch focus.
  returning?: boolean;
}

export function CrtScreen({ doc, onAgent, returning }: CrtScreenProps) {
  const glassRef = useRef<HTMLDivElement>(null);
  const switchRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<CrtController | null>(null);
  // undefined while the controller mounts. On a return the glass stays
  // dark meanwhile rather than flashing the HTML fallback.
  const [live, setLive] = useState(returning ? undefined : false);
  const [powerOn] = useState(returning ?? false);
  const handOver = useEffectEvent(onAgent);
  const soundOn = useSyncExternalStore(
    subscribeSound,
    soundEnabled,
    serverSoundEnabled
  );
  // Without a controller (no WebGL) there is no power-off to play.
  const switchToAgent = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.powerOff();
    } else {
      onAgent();
    }
  }, [onAgent]);

  useEffect(() => {
    if (powerOn) {
      switchRef.current?.focus();
    }
  }, [powerOn]);

  useEffect(() => {
    const glass = glassRef.current;
    const canvas = canvasRef.current;
    const copy = copyRef.current;
    if (!(glass && canvas && copy)) {
      return;
    }
    let disposed = false;
    CrtController.mount(glass, canvas, copy, doc, {
      onAgent: () => handOver(),
      powerOn,
    })
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
  }, [doc, powerOn]);

  return (
    <main className="crt-casing">
      <div className="crt-glass" ref={glassRef}>
        <canvas
          className={
            live === false ? "hidden" : "absolute inset-0 size-full touch-none"
          }
          ref={canvasRef}
        />
        <div
          className={
            live === false
              ? "absolute inset-0 overflow-y-auto bg-glass p-6 font-screen text-phosphor-dim"
              : "sr-only"
          }
          ref={copyRef}
        >
          <button
            aria-pressed={soundOn}
            className="mb-2 ml-auto block border border-phosphor-faint px-2 text-phosphor aria-pressed:bg-phosphor aria-pressed:text-glass"
            data-sound-switch
            onClick={toggleSound}
            type="button"
          >
            Sound
          </button>
          <button
            className="mb-6 ml-auto block border border-phosphor-faint px-2 text-phosphor"
            data-mode-switch
            onClick={switchToAgent}
            ref={switchRef}
            type="button"
          >
            Switch to agent view
          </button>
          <DocCopy doc={doc} />
        </div>
      </div>
    </main>
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
    case "contributions":
      return (
        <GitHubContributions
          grid={block.grid}
          linkId={ids.get(block.link)}
          profileUrl={block.link.href ?? ""}
        />
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
