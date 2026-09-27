import { connection } from "next/server";
import { SiteView } from "@/components/site-view";
import { toMarkdown } from "@/crt/markdown";
import { loadDoc } from "@/crt/sample-doc";

export default async function IndexPage() {
  // Render per request so ?view=agent is known on the server and the
  // right view arrives in the HTML.
  await connection();
  const doc = await loadDoc();
  return <SiteView doc={doc} markdown={toMarkdown(doc)} />;
}
