"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { GitHubContributions } from "@/components/github-contributions";
import { CrtController, crtRunning } from "@/crt/controller";
import {
  type Block,
  collectLinks,
  isInternal,
  type OpenRoles,
  type ScreenDoc,
  type Span,
} from "@/crt/doc";
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
  // The controller puts its canvas here. It owns the canvas so the lit
  // screen can move to the next page instead of being rebuilt.
  const hostRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<CrtController | null>(null);
  // undefined while the controller mounts. On a return, or when a screen
  // is already lit for this page to take over, the glass shows that
  // meanwhile rather than flashing the HTML fallback.
  const [live, setLive] = useState(() =>
    returning || crtRunning() ? undefined : false
  );
  const [powerOn] = useState(returning ?? false);
  const handOver = useEffectEvent(onAgent);
  const router = useRouter();
  const navigate = useEffectEvent((href: string) => router.push(href));
  const [open, setOpen] = useState<OpenRoles>(new Set());
  const toggleRole = useCallback((block: number) => {
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(block)) {
        next.add(block);
      }
      return next;
    });
  }, []);
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

  // A layout effect: a lit screen is taken over before the browser paints
  // the new page, so the picture never drops out between pages.
  useLayoutEffect(() => {
    const glass = glassRef.current;
    const host = hostRef.current;
    const copy = copyRef.current;
    if (!(glass && host && copy)) {
      return;
    }
    let disposed = false;
    CrtController.mount(glass, host, copy, doc, {
      onAgent: () => handOver(),
      onNavigate: (href) => navigate(href),
      onToggle: toggleRole,
      powerOn,
    })
      .then((controller) => {
        if (disposed) {
          controller?.release();
          return;
        }
        controllerRef.current = controller;
        setLive(controller !== null);
      })
      .catch(() => setLive(false));
    return () => {
      disposed = true;
      controllerRef.current?.release();
      controllerRef.current = null;
    };
  }, [doc, powerOn, toggleRole]);

  // `live` is here so a controller that mounts late still gets the roles
  // opened while the HTML copy was showing.
  useEffect(() => {
    if (live) {
      controllerRef.current?.setOpen(open);
    }
  }, [live, open]);

  return (
    <main className="crt-casing">
      <div className="crt-glass" ref={glassRef}>
        <div
          aria-hidden="true"
          className={live === false ? "hidden" : "absolute inset-0"}
          ref={hostRef}
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
          <DocCopy
            doc={doc}
            fallback={live === false}
            onToggle={toggleRole}
            open={open}
          />
        </div>
      </div>
    </main>
  );
}

type LinkIds = Map<Span, number>;

function Inline({
  ids,
  label,
  span,
}: {
  ids: LinkIds;
  // Accessible name when the link text alone says too little.
  label?: string;
  span: Span;
}) {
  const id = ids.get(span);
  if (!span.href || id === undefined) {
    return span.text;
  }
  if (isInternal(span.href)) {
    return (
      <Link className="text-phosphor underline" data-link={id} href={span.href}>
        {span.text}
      </Link>
    );
  }
  return (
    <a
      aria-label={label && `${label} (opens in a new tab)`}
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

function RoleCopy({
  block,
  ids,
  index,
  onToggle,
  open,
}: {
  block: Extract<Block, { kind: "role" }>;
  ids: LinkIds;
  index: number;
  onToggle: (block: number) => void;
  open: boolean;
}) {
  const detailsId = `role-${index}`;
  const toggle = useCallback(() => onToggle(index), [index, onToggle]);
  return (
    <article>
      <h3>
        <button
          aria-controls={detailsId}
          aria-expanded={open}
          className="text-left text-phosphor"
          data-link={ids.get(block.title)}
          onClick={toggle}
          type="button"
        >
          <span aria-hidden="true">{open ? "[-] " : "[+] "}</span>
          {block.title.text}
        </button>
      </h3>
      <p className="text-phosphor-faint">
        {block.dates} · {block.place}
      </p>
      <div hidden={!open} id={detailsId}>
        {block.lead ? (
          <p>
            <Spans ids={ids} spans={block.lead} />
          </p>
        ) : null}
        <ul className="list-inside list-['-_']">
          {block.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      </div>
    </article>
  );
}

// A picture, or a clip with its play control. On the CRT the canvas draws
// the clip from this <video>, so the button drives both; in the fallback
// the browser's own controls show.
function FigureCopy({
  block,
  fallback,
  ids,
}: {
  block: Extract<Block, { kind: "figure" }>;
  fallback: boolean;
  ids: LinkIds;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (video?.paused) {
      video.play().catch(() => {
        // Playback refused: the poster stays up.
      });
    } else {
      video?.pause();
    }
  }, []);
  const media = "h-auto w-full border border-phosphor-faint";
  if (block.video) {
    return (
      <figure>
        <video
          aria-label={block.alt}
          className={media}
          controls={fallback}
          data-figure={block.src}
          height={block.height}
          muted
          playsInline
          poster={block.src}
          preload="none"
          ref={videoRef}
          src={block.video}
          width={block.width}
        />
        {/* Never shown: the clip's controls say all of this. It names the
            clip for screen readers and is the keyboard's play control on
            the CRT. */}
        <figcaption className="sr-only">
          {block.caption}{" "}
          <button
            data-link={ids.get(block.link)}
            onClick={togglePlay}
            tabIndex={fallback ? -1 : undefined}
            type="button"
          >
            Play or pause the video
          </button>
        </figcaption>
      </figure>
    );
  }
  return (
    <figure>
      {/* biome-ignore lint/performance/noImgElement: a 576px copy, already the size it is drawn at. */}
      <img
        alt={block.alt}
        className={media}
        height={block.height}
        src={block.src}
        width={block.width}
      />
      <figcaption className="text-phosphor-faint">
        {block.caption}{" "}
        <Inline
          ids={ids}
          label={`${block.link.text}: ${block.alt}`}
          span={block.link}
        />
      </figcaption>
    </figure>
  );
}

function BlockCopy({
  block,
  fallback,
  ids,
  index,
  isFirstHeading,
  onToggle,
  open,
}: {
  block: Block;
  fallback: boolean;
  ids: LinkIds;
  index: number;
  isFirstHeading: boolean;
  onToggle: (block: number) => void;
  open: OpenRoles;
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
    case "role":
      return (
        <RoleCopy
          block={block}
          ids={ids}
          index={index}
          onToggle={onToggle}
          open={open.has(index)}
        />
      );
    case "contributions":
      return (
        <GitHubContributions
          grid={block.grid}
          linkId={ids.get(block.link)}
          profileUrl={block.link.href ?? ""}
        />
      );
    case "list":
      return (
        <ul className="list-inside list-['-_']">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case "figure":
      return <FigureCopy block={block} fallback={fallback} ids={ids} />;
    case "rule":
      return <hr className="border-phosphor-faint" />;
    default:
      return null;
  }
}

// Real HTML for screen readers, find-in-page, keyboard focus and the
// no-WebGL fallback.
function DocCopy({
  doc,
  fallback,
  onToggle,
  open,
}: {
  doc: ScreenDoc;
  // The copy is the visible page: no WebGL.
  fallback: boolean;
  onToggle: (block: number) => void;
  open: OpenRoles;
}) {
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
          fallback={fallback}
          ids={ids}
          index={i}
          isFirstHeading={i === firstHeading}
          key={`${block.kind}-${i}`}
          onToggle={onToggle}
          open={open}
        />
      ))}
    </div>
  );
}
