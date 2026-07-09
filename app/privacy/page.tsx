import type { Metadata } from "next";
import { InfoPage } from "@/components/info-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Learn what data UnlockED collects, how it is used, and how students can request deletion of their account data.",
  alternates: { canonical: "/privacy" },
};

export default function Page() {
  return <InfoPage
    eyebrow="Legal"
    title="Privacy Policy"
    intro="UnlockED collects only the information needed to run a personalized student opportunity dashboard and improve the service."
  >
    <section>
      <h2>Information UnlockED collects</h2>
      <p>If you sign in with Google, UnlockED receives basic Google account information such as your name, email address, and profile picture when Google provides one. Google authentication is handled through Google's OAuth services.</p>
      <p>UnlockED also stores the profile information you choose to provide: school, major, graduation year, interests, and career goals. This information is used to personalize your dashboard and recommend opportunities that better match your situation.</p>
      <p>When you save opportunities, UnlockED stores those saved items so you can return to them later. UnlockED may also collect usage analytics such as page visits, searches, saves, and onboarding completion to understand what is working and improve the product.</p>
    </section>

    <section>
      <h2>How the information is used</h2>
      <p>Your data is used to personalize recommendations, keep your profile and saved opportunities available across sessions, maintain account security, and improve the service. UnlockED does not sell user data.</p>
      <p>Usage analytics are reviewed in aggregate whenever possible. They help identify broken flows, confusing pages, popular searches, and areas where the opportunity catalog needs improvement.</p>
    </section>

    <section>
      <h2>Opportunity information</h2>
      <p>UnlockED listings come from public sources, official university pages, employers, scholarship sponsors, tool providers, and other public or official resources. Opportunities, deadlines, values, eligibility rules, and application requirements may change over time.</p>
      <p>UnlockED works to keep listings useful and clearly sourced, but students should always confirm current details with the official source before applying, claiming an offer, or making a decision.</p>
    </section>

    <section>
      <h2>Deleting your data</h2>
      <p>You may request deletion of your UnlockED account and associated data by contacting support@unlockededu.com from the email address connected to your account. Once verified, UnlockED will delete account data that is reasonably associated with your account, unless retention is required for security, legal, or operational reasons.</p>
    </section>

    <section>
      <h2>Data sharing</h2>
      <p>UnlockED does not sell personal data. UnlockED may use trusted service providers for hosting, authentication, analytics, storage, and security. These providers are used only to operate and improve UnlockED.</p>
    </section>

    <section>
      <h2>Contact</h2>
      <p>Questions about privacy or data deletion can be sent to support@unlockededu.com.</p>
    </section>

    <p className="text-sm text-ink/45">Last updated: July 9, 2026</p>
  </InfoPage>;
}
