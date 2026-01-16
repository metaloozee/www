import { Suspense } from "react";
import HomeContent from "./home-content";

function LoadingFallback() {
  return (
    <section className="container relative flex max-w-2xl flex-col items-center justify-center space-y-14 px-4 py-10">
      <h1 className="sr-only">Ayan - Full-Stack Developer & AI Enthusiast</h1>
      <div className="animate-pulse space-y-10">
        <div className="h-32 w-full rounded-lg bg-muted" />
        <div className="h-24 w-3/4 rounded-lg bg-muted" />
      </div>
    </section>
  );
}

export default function IndexPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <HomeContent />
    </Suspense>
  );
}
