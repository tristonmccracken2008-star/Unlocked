import { SkeletonBlock } from "@/components/loading-system";

export default function PlannerLoading() {
  return <main className="px-5 py-10 sm:px-8 sm:py-14" aria-label="Loading Opportunity Planner" aria-busy="true">
    <div className="mx-auto max-w-[90rem]">
      <div className="border-b border-ink/10 pb-10"><SkeletonBlock className="h-3 w-36 rounded" /><SkeletonBlock className="mt-4 h-20 max-w-2xl rounded-lg" /><SkeletonBlock className="mt-5 h-5 max-w-xl rounded" /></div>
      <div className="mt-12 grid gap-16 lg:grid-cols-[1.45fr_.55fr]"><div><SkeletonBlock className="h-10 w-48 rounded" />{Array.from({ length: 3 }, (_, index) => <SkeletonBlock key={index} className="mt-4 h-24 rounded-lg" />)}<SkeletonBlock className="mt-16 h-10 w-48 rounded" /><SkeletonBlock className="mt-4 h-28 rounded-lg" /></div><div>{Array.from({ length: 5 }, (_, index) => <SkeletonBlock key={index} className="mb-3 h-14 rounded-lg" />)}</div></div>
    </div>
  </main>;
}
