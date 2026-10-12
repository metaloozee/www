import type { Metadata } from "next";
import { SiteView } from "@/components/site-view";
import { toMarkdown } from "@/crt/markdown";
import { loadDoc } from "@/crt/sample-doc";
import { HOME_ALTERNATES } from "@/lib/site";

export const revalidate = 86_400;

// The agent view of the home page, served for /?view=agent.
export const metadata: Metadata = { alternates: HOME_ALTERNATES };

export default async function AgentPage() {
  const doc = await loadDoc();
  return <SiteView doc={doc} initialView="agent" markdown={toMarkdown(doc)} />;
}
