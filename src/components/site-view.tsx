"use client";

import { useCallback, useEffect, useState } from "react";
import { AgentView } from "@/components/agent-view";
import { CrtScreen } from "@/components/crt-screen";
import type { ScreenDoc } from "@/crt/doc";
import { armSound } from "@/crt/sound";

type View = "human" | "agent";

// ?view=agent. Human is the default and keeps the URL clean. Switching
// replaces the entry, so Back leaves the site instead of flipping modes.
const VIEW_URL: Record<View, string> = { agent: "/?view=agent", human: "/" };

export function SiteView({
  doc,
  initialView,
  markdown,
}: {
  doc: ScreenDoc;
  initialView: View;
  markdown: string;
}) {
  const [view, setView] = useState(initialView);
  // A view that was switched to, rather than loaded, takes focus and the
  // CRT powers on rather than cold-booting.
  const [switched, setSwitched] = useState(false);
  useEffect(armSound, []);

  const switchTo = useCallback((next: View) => {
    setView(next);
    setSwitched(true);
    history.replaceState(null, "", VIEW_URL[next]);
  }, []);
  const toHuman = useCallback(() => switchTo("human"), [switchTo]);
  const toAgent = useCallback(() => switchTo("agent"), [switchTo]);

  if (view === "agent") {
    return (
      <AgentView focusSwitch={switched} markdown={markdown} onHuman={toHuman} />
    );
  }
  return <CrtScreen doc={doc} onAgent={toAgent} returning={switched} />;
}
