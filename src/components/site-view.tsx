"use client";

import { useCallback, useEffect, useState } from "react";
import { AgentView } from "@/components/agent-view";
import { CrtScreen } from "@/components/crt-screen";
import type { ScreenDoc } from "@/crt/doc";
import { armSound } from "@/crt/sound";

type View = "human" | "agent";

// ?view=agent on the page's own path. Human is the default and keeps the
// URL clean. Switching replaces the entry, so Back leaves the page instead
// of flipping modes.
const viewUrl = (path: string, view: View) =>
  view === "agent" ? `${path}?view=agent` : path;

export function SiteView({
  doc,
  initialView,
  markdown,
  path,
}: {
  doc: ScreenDoc;
  initialView: View;
  markdown: string;
  // The page's canonical path: "/" or "/projects/<slug>".
  path: string;
}) {
  const [view, setView] = useState(initialView);
  // A view that was switched to, rather than loaded, takes focus and the
  // CRT powers on rather than cold-booting.
  const [switched, setSwitched] = useState(false);
  useEffect(armSound, []);

  const switchTo = useCallback(
    (next: View) => {
      setView(next);
      setSwitched(true);
      history.replaceState(null, "", viewUrl(path, next));
    },
    [path]
  );
  const toHuman = useCallback(() => switchTo("human"), [switchTo]);
  const toAgent = useCallback(() => switchTo("agent"), [switchTo]);

  if (view === "agent") {
    return (
      <AgentView
        focusSwitch={switched}
        markdown={markdown}
        markdownPath={`${path === "/" ? "" : path}/index.md`}
        onHuman={toHuman}
      />
    );
  }
  return <CrtScreen doc={doc} onAgent={toAgent} returning={switched} />;
}
