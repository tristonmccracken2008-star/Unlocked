import type { Metadata } from "next";
import { InfoPage } from "@/components/info-page";

export const metadata: Metadata = { title: "Help", description: "Learn what UnlockED is, how recommendations work, how verification works, and answers to common questions.", alternates: { canonical: "/help" } };

export default function Page() {
  return <InfoPage eyebrow="Help" title="How UnlockED works" intro="A practical guide to using UnlockED and understanding the trust signals on each listing.">
    <section><h2>What UnlockED is</h2><p>UnlockED is a student opportunity directory. It helps students discover scholarships, research, internships, AI tools, student benefits, competitions, and career resources connected to their school, major, year, and goals.</p></section>
    <section><h2>How recommendations work</h2><p>Recommendations compare your saved profile with opportunity fields such as school scope, eligible schools, majors, academic years, category, tags, location, verification status, and content completeness. School-specific verified opportunities receive a strong match boost, while expired or unrelated opportunities are deprioritized.</p></section>
    <section><h2>How verification works</h2><p>Listings include a verification status and last verified date. Verified listings were checked against official provider, university, employer, or sponsor sources. Needs-review listings may still be useful, but students should confirm details carefully before acting.</p></section>
    <section><h2>Frequently asked questions</h2><h3>Do I need an account?</h3><p>No. You can browse public opportunities without signing in. An account lets you sync your profile, saved opportunities, and tracker across devices.</p><h3>Does UnlockED decide eligibility?</h3><p>No. Eligibility is determined by the official provider, university, employer, or sponsor.</p><h3>Why do some values say unknown?</h3><p>UnlockED shows unknown when the official source does not publish a fixed dollar value. We avoid inventing values that cannot be verified.</p><h3>How do I report outdated information?</h3><p>Use the report-outdated control on opportunity detail pages or contact hello@unlocked.education with the official source link and what changed.</p></section>
  </InfoPage>;
}
