"use client";

import Link from "next/link";
import { useEffect } from "react";
import { trackProductEvent } from "@/data/product-analytics";
import {
  ArrowIcon,
  BookmarkIcon,
  CalendarIcon,
  ListIcon,
  PenLineIcon,
  SearchIcon,
  TrophyIcon,
} from "./icons";

const stages = [
  {
    id: "find",
    label: "Find",
    title: "Find something worth pursuing.",
    copy: "Search everything, browse a curated starting point, or review matches selected for your profile.",
    href: "/opportunities",
    action: "Open Discover",
    icon: SearchIcon,
    items: [
      [
        "discover",
        "Discover",
        "Search and filter the complete catalog.",
        "/opportunities",
      ],
      ["explore", "Explore", "Browse fields and experience types.", "/explore"],
      [
        "collections",
        "Collections",
        "Start with a curated group.",
        "/collections",
      ],
      ["for-you", "For You", "Review your verified shortlist.", "/advisor"],
      ["paths", "Paths", "See opportunities connected to a goal.", "/paths"],
    ],
  },
  {
    id: "pursue",
    label: "Pursue",
    title: "Keep the opportunities you choose.",
    copy: "Add an opportunity to Journey when you want to track it. Watch is for something you only want to monitor.",
    href: "/",
    action: "Open Journey",
    icon: BookmarkIcon,
    items: [
      ["journey", "Journey", "Update what you are actively pursuing.", "/"],
      ["planner", "Planner", "Look ahead across confirmed dates.", "/planner"],
      [
        "deadlines",
        "Calendar",
        "Manage specific dates and reminders.",
        "/#journey-calendar",
      ],
      [
        "conflict-planning",
        "Busy periods",
        "See when known dates bunch together.",
        "/?calendar=conflicts#journey-upcoming-heading",
      ],
    ],
  },
  {
    id: "apply",
    label: "Apply",
    title: "Prepare one application at a time.",
    copy: "Applications shows what needs attention. Open one application for its requirements, tasks, materials, dates, and submission record.",
    href: "/applications",
    action: "Open Applications",
    icon: ListIcon,
    items: [
      [
        "applications",
        "Applications",
        "Review work across active applications.",
        "/applications",
      ],
      [
        "notifications",
        "Notifications",
        "Review deadlines and meaningful changes.",
        "/notifications",
      ],
    ],
  },
  {
    id: "build",
    label: "Build",
    title: "Turn experience into reusable materials.",
    copy: "Experience Bank keeps confirmed facts. Resumes decide how to present them. Materials connects the versions you choose to applications; files stay where you keep them.",
    href: "/build",
    action: "Open Build",
    icon: PenLineIcon,
    items: [
      [
        "build-overview",
        "Build overview",
        "See your assets and what needs attention.",
        "/build",
      ],
      [
        "experience-bank",
        "Experience Bank",
        "Keep factual work once and reuse it.",
        "/resume-lab?view=experience",
      ],
      [
        "resume-lab",
        "Resumes",
        "Build master and targeted resume versions.",
        "/resume-lab?view=resumes",
      ],
      [
        "materials",
        "Materials",
        "Organize reusable asset records.",
        "/materials",
      ],
    ],
  },
  {
    id: "look-back",
    label: "Look back",
    title: "Keep a factual record of what you did.",
    copy: "Accomplishments stores completed outcomes. Insights summarizes the private history already recorded in your account.",
    href: "/accomplishments",
    action: "Open Accomplishments",
    icon: TrophyIcon,
    items: [
      [
        "accomplishments",
        "Accomplishments",
        "Keep completed and earned outcomes.",
        "/accomplishments",
      ],
      [
        "insights",
        "Insights",
        "Review a factual summary of your history.",
        "/insights",
      ],
    ],
  },
] as const;

export function LearnUnlocked() {
  useEffect(() => {
    trackProductEvent("learn_unlocked_opened_v1");
  }, []);
  return (
    <main className="px-5 py-10 sm:px-8 sm:py-14">
      <div className="mx-auto max-w-6xl">
        <header className="max-w-3xl border-b border-ink/10 pb-8">
          <p className="rule-label text-forest">Learn UnlockED</p>
          <h1 className="mt-3 font-editorial text-4xl font-bold text-ink sm:text-6xl">
            From finding it to finishing it.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/55">
            Five parts of one workflow. Start with the step you need.
          </p>
        </header>

        <div className="divide-y divide-ink/10">
          {stages.map((stage, index) => {
            const Icon = stage.icon;
            return (
              <section
                id={stage.id}
                key={stage.id}
                className="grid gap-7 py-9 lg:grid-cols-[minmax(0,.8fr)_minmax(24rem,1.2fr)] lg:gap-14"
              >
                <div className="max-w-xl">
                  <div className="flex items-center gap-3">
                    <span
                      className="grid h-10 w-10 place-items-center rounded-lg bg-forest/[.07] text-forest"
                      aria-hidden="true"
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <p className="rule-label text-forest">
                      {index + 1}. {stage.label}
                    </p>
                  </div>
                  <h2 className="mt-4 font-editorial text-3xl font-bold text-ink sm:text-4xl">
                    {stage.title}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-ink/55">
                    {stage.copy}
                  </p>
                  <Link
                    href={stage.href}
                    className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-forest hover:text-ink"
                  >
                    {stage.action} <ArrowIcon className="h-3 w-3" />
                  </Link>
                </div>
                <div className="divide-y divide-ink/10 border-y border-ink/10">
                  {stage.items.map(([id, title, copy, href]) => (
                    <Link
                      id={id}
                      key={id}
                      href={href}
                      className="group grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-forest/20"
                    >
                      <span>
                        <strong className="block text-ink">{title}</strong>
                        <small className="mt-1 block leading-5 text-ink/50">
                          {copy}
                        </small>
                      </span>
                      <ArrowIcon className="h-3.5 w-3.5 text-forest transition group-hover:translate-x-0.5" />
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <aside
          id="getting-started"
          className="mt-4 flex flex-col justify-between gap-5 border-y border-ink/10 py-7 sm:flex-row sm:items-center"
        >
          <div>
            <h2 className="font-editorial text-2xl font-bold text-ink">
              Account, privacy, and verification
            </h2>
            <p
              id="trust"
              className="mt-2 max-w-2xl text-sm leading-6 text-ink/55"
            >
              Update your profile from one place. UnlockED labels verified facts
              and links to official sources; it never guarantees eligibility or
              an outcome.
            </p>
          </div>
          <Link
            id="profile"
            href="/profile"
            className="inline-flex min-h-11 shrink-0 items-center gap-2 text-sm font-bold text-forest hover:text-ink"
          >
            Open Profile <ArrowIcon className="h-3 w-3" />
          </Link>
        </aside>
      </div>
    </main>
  );
}
