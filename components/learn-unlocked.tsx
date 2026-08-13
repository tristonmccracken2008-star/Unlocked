"use client";

import Link from "next/link";
import { useEffect } from "react";
import { trackProductEvent } from "@/data/product-analytics";
import { ArrowIcon, BellIcon, BookmarkIcon, CalendarIcon, CheckIcon, PenLineIcon, SearchIcon, SparkIcon, TargetIcon } from "./icons";

const sections = [
  { id: "getting-started", title: "Getting started", copy: "Build your private profile once. UnlockED uses it to check eligibility and keep the rest of the product relevant.", href: "/profile", action: "Review profile", icon: PenLineIcon },
  { id: "discover", title: "Discover", copy: "Search the complete catalog, use filters to narrow it, and open the official source before applying.", href: "/opportunities", action: "Open Discover", icon: SearchIcon },
  { id: "trust", title: "How verification works", copy: "UnlockED labels verified deadlines and requirements field by field. A recommendation can fit your profile without guaranteeing eligibility.", href: "/opportunities", action: "Review opportunities", icon: CheckIcon },
  { id: "for-you", title: "For You", copy: "A smaller set prioritized from your profile, interests, and Journey activity. Match labels show the strongest factual reasons.", href: "/advisor", action: "Open For You", icon: SparkIcon },
  { id: "journey", title: "Journey", copy: "Keep opportunities, progress, important dates, and confirmed outcomes in one private record.", href: "/?guide=journey", action: "Replay Journey guide", icon: BookmarkIcon },
  { id: "applications", title: "Applications", copy: "Verified requirements and your private tasks stay attached to the opportunity you are pursuing.", href: "/?guide=journey_application_workspace#active-opportunities", action: "Learn about applications", icon: TargetIcon },
  { id: "deadlines", title: "Deadlines", copy: "Official deadlines and personal dates appear together. Add reminders only for dates you want to manage.", href: "/?guide=journey_calendar", action: "Learn about deadlines", icon: CalendarIcon },
  { id: "notifications", title: "Notifications", copy: "Review deadline reminders, meaningful saved-opportunity changes, and Journey follow-ups without a noisy feed.", href: "/notifications", action: "Open notifications", icon: BellIcon },
  { id: "profile", title: "Profile and privacy", copy: "Update personalization, notification, privacy, appearance, billing, and account controls from one place.", href: "/profile", action: "Open profile", icon: PenLineIcon },
] as const;

export function LearnUnlocked() {
  useEffect(() => { trackProductEvent("learn_unlocked_opened_v1"); }, []);
  return <main className="px-5 py-10 sm:px-8 sm:py-14">
    <div className="mx-auto max-w-6xl">
      <header className="max-w-3xl border-b border-ink/10 pb-8">
        <p className="rule-label text-forest">Learn UnlockED</p>
        <h1 className="mt-3 font-editorial text-4xl font-bold text-ink sm:text-6xl">Help, when you need it.</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/55">A short reference for the parts of UnlockED you already have. Replay a guide to see the feature in your own account.</p>
      </header>
      <div className="mt-9 grid gap-x-10 gap-y-2 md:grid-cols-2">
        {sections.map((section) => {
          const Icon = section.icon;
          return <section id={section.id} key={section.id} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-4 border-b border-ink/10 py-6">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-forest/[.07] text-forest" aria-hidden="true"><Icon className="h-4 w-4" /></span>
            <div><h2 className="font-editorial text-2xl font-bold text-ink">{section.title}</h2><p className="mt-2 text-sm leading-6 text-ink/55">{section.copy}</p><Link href={section.href} className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-forest hover:text-ink">{section.action} <ArrowIcon className="h-3 w-3" /></Link></div>
          </section>;
        })}
      </div>
      <p className="mt-8 text-xs leading-5 text-ink/45">Guides use your real interface and never create demo opportunities, tasks, or milestones.</p>
    </div>
  </main>;
}
