"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useCallback, useState } from "react";
import { AgentView } from "@/components/agent-view";
import { CrtScreen } from "@/components/crt-screen";
import type { ScreenDoc } from "@/crt/doc";

// ?view=agent. Human is the default and keeps the URL clean. Switching
// replaces the entry, so Back leaves the site instead of flipping modes.
const viewParser = parseAsStringLiteral(["human", "agent"])
  .withDefault("human")
  .withOptions({ history: "replace" });

export function SiteView({
  doc,
  markdown,
}: {
  doc: ScreenDoc;
  markdown: string;
}) {
  const [view, setView] = useQueryState("view", viewParser);
  // A view that differs from the one the page loaded with was switched to,
  // so it takes focus and the CRT powers on rather than cold-booting.
  const [shown, setShown] = useState(view);
  const [switched, setSwitched] = useState(false);
  if (view !== shown) {
    setShown(view);
    setSwitched(true);
  }

  const toHuman = useCallback(() => setView("human"), [setView]);
  const toAgent = useCallback(() => setView("agent"), [setView]);

  if (view === "agent") {
    return (
      <AgentView focusSwitch={switched} markdown={markdown} onHuman={toHuman} />
    );
  }
  return <CrtScreen doc={doc} onAgent={toAgent} returning={switched} />;
}
