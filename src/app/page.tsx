import type { Metadata } from "next";
import { SiteView } from "@/components/site-view";
import { toMarkdown } from "@/crt/markdown";
import { loadDoc } from "@/crt/sample-doc";
import { HOME_ALTERNATES, PROFILE_JSON_LD } from "@/lib/site";

// Static, rebuilt daily for the contribution graph. ?view=agent is
// rewritten to /agent in next.config.mjs, so neither view needs the request.
export const revalidate = 86_400;

export const metadata: Metadata = { alternates: HOME_ALTERNATES };

// "<" is escaped so no string in the data can close the script element.
const jsonLd = JSON.stringify(PROFILE_JSON_LD).replace(/</g, "\\u003c");

export default async function IndexPage() {
  const doc = await loadDoc();
  return (
    <>
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD must be raw; React would entity-escape it as text.
        dangerouslySetInnerHTML={{ __html: jsonLd }}
        type="application/ld+json"
      />
      <SiteView
        doc={doc}
        initialView="human"
        markdown={toMarkdown(doc)}
        path="/"
      />
    </>
  );
}
