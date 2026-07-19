import { InfoPage } from "@/components/info-page";
import { publicPageMetadata } from "@/lib/public-metadata";

export const metadata = publicPageMetadata("Terms of Service", "Read the UnlockED terms for using the student opportunity directory and personalized recommendations.", "/terms");

export default function Page() {
  return <InfoPage
    eyebrow="Legal"
    title="Terms of Service"
    intro="These terms explain how students and visitors may use UnlockED."
  >
    <section>
      <h2>Informational platform</h2>
      <p>UnlockED is an informational platform that helps students discover scholarships, internships, research opportunities, AI tools, student benefits, competitions, career resources, and related opportunities.</p>
      <p>UnlockED does not administer listed opportunities and does not decide who receives scholarships, internships, admissions, funding, employment, benefits, or other outcomes.</p>
    </section>

    <section>
      <h2>Official sources control</h2>
      <p>UnlockED summarizes information from public or official sources when available. You are responsible for verifying deadlines, eligibility, requirements, award amounts, terms, and application instructions with the official source before applying or relying on a listing.</p>
      <p>UnlockED may update, remove, or revise listings as sources change.</p>
    </section>

    <section>
      <h2>Accounts</h2>
      <p>If you create an account, you are responsible for keeping access to your Google account secure. You should provide accurate profile information if you want useful recommendations.</p>
      <p>UnlockED may suspend or restrict accounts that abuse the service, attempt unauthorized access, submit misleading information, or interfere with other users.</p>
    </section>

    <section>
      <h2>Acceptable use</h2>
      <p>You may not abuse, scrape, attack, reverse engineer, overload, disrupt, or interfere with UnlockED or its systems. You may not attempt to bypass authentication, access another user's account, or use UnlockED in a way that violates the law or another service's terms.</p>
    </section>

    <section>
      <h2>No guarantees</h2>
      <p>UnlockED does not guarantee scholarships, internships, admissions, employment, funding, free products, discounts, acceptance into programs, or any other result. Listings are provided to help you discover and evaluate opportunities, not as a promise of eligibility or outcome.</p>
    </section>

    <section>
      <h2>Limitation of liability</h2>
      <p>To the fullest extent permitted by law, UnlockED is not liable for indirect, incidental, special, consequential, or punitive damages, or for losses connected to your use of the service, reliance on listings, third-party websites, missed deadlines, eligibility decisions, or opportunity outcomes.</p>
    </section>

    <section>
      <h2>Changes to these terms</h2>
      <p>These terms may be updated over time. When they change, UnlockED will update the date on this page. Continuing to use UnlockED after an update means you accept the updated terms.</p>
    </section>

    <section>
      <h2>Contact</h2>
      <p>Questions about these terms can be sent to support@unlockededu.com.</p>
    </section>

    <p className="text-sm text-ink/45">Last updated: July 9, 2026</p>
  </InfoPage>;
}
