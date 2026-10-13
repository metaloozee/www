import { toMarkdown } from "@/crt/markdown";
import { loadDoc } from "@/crt/sample-doc";

export const revalidate = 86_400;

export async function GET() {
  return new Response(toMarkdown(await loadDoc()), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
