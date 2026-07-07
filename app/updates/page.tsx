import type { Metadata } from "next";
import Link from "next/link";
import { WhatsNewFeed } from "@/components/whats-new-feed";

export const metadata: Metadata = {
  title: "What's New",
  description: "See the newest, newly verified, and recently updated student opportunities in UnlockED.",
  alternates: { canonical: "/updates" },
};

export default function UpdatesPage() {
  return (
    <section className="px-5 py-10 sm:px-8 sm:py-14">
      <div className="mx-auto max-w-4xl">
        <nav aria-label="Breadcrumb" className="text-xs font-bold uppercase tracking-wider text-ink/45">
          <Link href="/" className="hover:text-forest">Dashboard</Link> / What&apos;s New
        </nav>
        <p className="rule-label mt-6 text-forest">Opportunity updates</p>
        <h1 className="mt-3 font-editorial text-4xl font-bold sm:text-5xl">What&apos;s New</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-ink/55">
          Newly added, newly verified, and recently updated opportunities, sorted by the latest documented change.
        </p>
        <div className="mt-8 border-t-2 border-ink pt-3">
          <WhatsNewFeed showViewAll={false} />
        </div>
      </div>
    </section>
  );
}
