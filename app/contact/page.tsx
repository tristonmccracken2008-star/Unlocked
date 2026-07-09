import type { Metadata } from "next";
import { InfoPage } from "@/components/info-page";

export const metadata: Metadata = {
  title: "Contact UnlockED",
  description: "Contact UnlockED for support, corrections, outdated listings, feedback, or opportunity suggestions.",
  alternates: { canonical: "/contact" },
};

export default function Page() {
  return <InfoPage
    eyebrow="Contact"
    title="Contact UnlockED"
    intro="Send questions, corrections, source updates, or opportunity suggestions. Most messages receive a response within 2-3 business days."
  >
    <section>
      <h2>Email</h2>
      <p>For support, corrections, or data deletion requests, email support@unlockededu.com. If you are reporting an outdated listing, include the opportunity name, what changed, and the current official source link when possible.</p>
      <a href="mailto:support@unlockededu.com?subject=UnlockED%20support" className="mt-5 inline-flex border-b-2 border-ink pb-1 font-bold text-forest hover:border-forest">support@unlockededu.com</a>
    </section>

    <section>
      <h2>Contact form</h2>
      <form action="mailto:support@unlockededu.com" method="post" encType="text/plain" className="mt-5 grid gap-4">
        <label className="block">
          <span className="mb-2 block text-sm font-bold">Name</span>
          <input name="name" autoComplete="name" className="min-h-12 w-full border border-ink/20 bg-white px-4 outline-none focus:border-forest" />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-bold">Email</span>
          <input name="email" type="email" autoComplete="email" className="min-h-12 w-full border border-ink/20 bg-white px-4 outline-none focus:border-forest" />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-bold">Message</span>
          <textarea name="message" rows={6} className="w-full resize-none border border-ink/20 bg-white px-4 py-3 outline-none focus:border-forest" />
        </label>
        <button type="submit" className="inline-flex min-h-12 w-fit items-center justify-center bg-forest px-6 text-sm font-bold uppercase tracking-wider text-white hover:bg-ink">Send message</button>
      </form>
      <p className="mt-4 text-sm leading-6 text-ink/45">The form opens your email app so you can review the message before sending.</p>
    </section>
  </InfoPage>;
}
