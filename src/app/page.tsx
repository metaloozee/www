import { CrtScreen } from "@/components/crt-screen";
import { GITHUB_USER, sampleDoc } from "@/crt/sample-doc";
import {
  getContributions,
  toContributionGrid,
} from "@/lib/github-contributions";

export default async function IndexPage() {
  const grid = toContributionGrid(await getContributions(GITHUB_USER));
  return <CrtScreen doc={sampleDoc(grid)} />;
}
