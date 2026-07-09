import type { Metadata } from "next";
import { InfoPage } from "@/components/info-page";

export const metadata: Metadata = { title: "Terms of Service", description: "Read the UnlockED terms of service for using the student opportunity directory.", alternates: { canonical: "/terms" } };

export default function Page() {
  return <InfoPage eyebrow="Legal" title="Terms of Service" intro="These terms explain how students, families, and visitors may use UnlockED.">
    <section><h2>Informational directory</h2><p>UnlockED provides an informational directory of student opportunities, benefits, and resources. UnlockED does not administer listed offers, determine eligibility, award scholarships, provide financial advice, or guarantee access to any opportunity.</p></section>
    <section><h2>Official sources control</h2><p>Listings summarize information from official provider, university, employer, or sponsor sources when available. Current terms, deadlines, prices, eligibility, and application requirements are controlled by the official source.</p></section>
    <section><h2>Accounts</h2><p>If you sign in, you are responsible for keeping your account access secure. You may sign out at any time. UnlockED may restrict access to administrative or account-only areas when a session is missing or invalid.</p></section>
    <section><h2>Acceptable use</h2><p>Do not misuse UnlockED, interfere with the service, attempt unauthorized access, submit misleading information, or use the directory to violate another service's terms.</p></section>
    <section><h2>No warranties</h2><p>UnlockED is provided as-is. We work to keep information accurate and useful, but we do not warrant that every listing is complete, current, error-free, or suitable for your circumstances.</p></section>
    <section><h2>Contact</h2><p>Questions about these terms can be sent to hello@unlocked.education.</p></section>
    <p className="text-sm text-ink/45">Last updated: July 9, 2026</p>
  </InfoPage>;
}
