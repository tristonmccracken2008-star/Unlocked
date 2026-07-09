import type { Metadata } from "next";
import { InfoPage } from "@/components/info-page";

export const metadata: Metadata = {
  title: "About UnlockED",
  description: "Learn why UnlockED was built and how it helps students discover verified scholarships, internships, research, AI tools, benefits, and career resources.",
  alternates: { canonical: "/about" },
};

export default function Page() {
  return <InfoPage
    eyebrow="About UnlockED"
    title="One place for the opportunities students usually miss"
    intro="UnlockED was built to make college opportunities easier to find, understand, and act on."
  >
    <section>
      <h2>Why UnlockED exists</h2>
      <p>UnlockED was built by a college student who wanted one reliable place to discover scholarships, internships, research opportunities, AI tools, student benefits, competitions, and career resources.</p>
      <p>Too many useful opportunities are scattered across university pages, provider websites, scholarship portals, career offices, student groups, and old lists. Students should not have to know the right office, keyword, or hidden page before they can find something valuable.</p>
    </section>

    <section>
      <h2>The mission</h2>
      <p>The mission is simple: help students discover opportunities they would otherwise miss.</p>
      <p>UnlockED organizes opportunities around the details that matter most to students, including school, major, graduation year, interests, and goals. The product is intentionally quiet and practical so students can quickly understand what is worth opening next.</p>
    </section>

    <section>
      <h2>How trust works</h2>
      <p>UnlockED prioritizes official sources, clear descriptions, verification status, and last-verified dates. Every listing should help students understand what it is, who it is for, why it matters, and where to confirm the details.</p>
      <p>UnlockED is independent unless a page clearly says otherwise. Schools, employers, providers, and scholarship sponsors control their own terms, deadlines, eligibility, and application requirements.</p>
    </section>
  </InfoPage>;
}
