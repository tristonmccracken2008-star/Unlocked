"use client";

import Link from "next/link";
import { useState } from "react";
import type { ResumeExperienceRecord, ResumeLabStore } from "@/data/resume-lab";
import { ActivityForm } from "./high-school-build";

const tabItems = [
  ["overview", "Overview"],
  ["facts", "What I Did"],
  ["accomplishments", "Accomplishments"],
  ["skills", "Skills"],
  ["application", "Application Versions"],
  ["history", "History"],
  ["passport", "Passport"],
] as const;
export function HighSchoolActivityDetail({
  initialStore,
  experienceId,
  passportVisible,
}: {
  initialStore: ResumeLabStore;
  experienceId: string;
  passportVisible: boolean;
}) {
  const [store, setStore] = useState(initialStore);
  const [tab, setTab] = useState<(typeof tabItems)[number][0]>("overview");
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const record = store.experiences[experienceId];
  if (!record) return null;
  const set = Object.values(store.applicationActivitySets ?? {})[0];
  const selected = set?.selectedExperienceIds.includes(record.id);
  const appVersion = set?.versions[record.id];
  async function confirmFact(factId: string, confirmed: boolean) {
    setMessage("");
    const response = await fetch("/api/high-school-activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "set_fact_confirmation",
        expectedVersion: store.version,
        experienceId: record.id,
        factId,
        confirmed,
      }),
    });
    const data = (await response.json()) as {
      error?: string;
      store?: ResumeLabStore;
    };
    if (!response.ok || !data.store) {
      setMessage(data.error ?? "Could not update this fact.");
      return;
    }
    setStore(data.store);
    setMessage("Saved");
  }
  return (
    <main className="min-h-screen px-5 pb-28 pt-10 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <nav className="text-xs font-bold text-ink/40">
          <Link href="/build" className="hover:text-forest">
            Activities &amp; Experiences
          </Link>
          <span className="px-2">/</span>
          {record.title}
        </nav>
        <header className="mt-6 border-b border-ink/10 pb-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="rule-label text-forest">
                {record.highSchool?.category ?? "Experience"} · Private
              </p>
              <h1 className="mt-3 font-editorial text-5xl font-semibold leading-tight">
                {record.title}
              </h1>
              <p className="mt-3 text-sm text-ink/50">
                {[record.organization, record.current ? "Ongoing" : "Completed"]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditing((value) => !value)}
              className="min-h-11 rounded-full border border-ink/10 px-4 text-sm font-bold text-forest"
            >
              {editing ? "Close editor" : "Edit experience"}
            </button>
          </div>
        </header>
        {editing ? (
          <div className="mt-6">
            <ActivityForm
              store={store}
              record={record}
              onSaved={(next) => {
                setStore(next);
                setEditing(false);
              }}
            />
          </div>
        ) : null}
        <nav
          aria-label="Activity sections"
          className="mt-6 flex gap-1 overflow-x-auto border-b border-ink/10 pb-3"
        >
          {tabItems.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={tab === id}
              onClick={() => setTab(id)}
              className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-bold ${tab === id ? "bg-forest text-white" : "text-ink/45 hover:bg-forest/[.06]"}`}
            >
              {label}
            </button>
          ))}
        </nav>
        {message ? (
          <p
            role="status"
            className={`mt-4 text-sm font-bold ${message === "Saved" ? "text-forest" : "text-red-700"}`}
          >
            {message}
          </p>
        ) : null}
        {tab === "overview" ? (
          <section className="mt-7 grid gap-px overflow-hidden rounded-2xl border border-ink/10 bg-ink/10 sm:grid-cols-3">
            <Summary
              label="Participation"
              value={
                (record.highSchool?.grades ?? [])
                  .map((grade) => `${grade} grade`)
                  .join(" · ") || "Not added"
              }
            />
            <Summary
              label="Time"
              value={
                record.highSchool?.hoursPerWeek === undefined
                  ? "Hours unknown"
                  : `${record.highSchool.hoursPerWeek} hr/week · ${record.highSchool.weeksPerYear ?? "unknown"} weeks/year`
              }
            />
            <Summary
              label="Role now"
              value={
                record.highSchool?.roleHistory.at(-1)?.title ?? "Not added"
              }
            />
          </section>
        ) : null}
        {tab === "facts" ? (
          <section className="mt-7">
            <div className="max-w-2xl">
              <h2 className="font-editorial text-3xl font-semibold">
                Confirmed facts stay separate from application wording.
              </h2>
              <p className="mt-3 text-sm leading-6 text-ink/50">
                Imported information remains unconfirmed until you review it.
                Unknown is always acceptable.
              </p>
            </div>
            <div className="mt-6 divide-y divide-ink/10 border-y border-ink/10">
              {record.facts.map((fact) => (
                <label key={fact.id} className="flex gap-4 py-5">
                  <input
                    type="checkbox"
                    checked={fact.confirmed}
                    onChange={(event) =>
                      void confirmFact(fact.id, event.target.checked)
                    }
                    className="mt-1 h-4 w-4 accent-forest"
                  />
                  <span>
                    <strong className="block text-sm">{fact.text}</strong>
                    <small className="mt-1 block text-xs text-ink/40">
                      {fact.confirmed
                        ? "Confirmed by you"
                        : `${fact.source === "import" ? "Imported" : "Unconfirmed"} · review before reuse`}
                    </small>
                  </span>
                </label>
              ))}
              {!record.facts.length ? (
                <p className="py-8 text-sm text-ink/45">
                  No facts recorded yet. Edit the experience to add what you
                  did.
                </p>
              ) : null}
            </div>
          </section>
        ) : null}
        {tab === "accomplishments" ? (
          <section className="mt-7 max-w-3xl rounded-2xl border border-ink/10 bg-[var(--unlocked-surface)] p-6">
            <h2 className="font-editorial text-3xl font-semibold">
              Experience is not accomplishment.
            </h2>
            <p className="mt-3 text-sm leading-6 text-ink/50">
              Roles, awards, promotions, completed projects, and results belong
              in the existing Accomplishments record only when they are true.
              Nothing here is converted automatically.
            </p>
            <Link
              href="/accomplishments"
              className="mt-5 inline-flex min-h-11 items-center rounded-full bg-ink px-4 text-sm font-bold text-white"
            >
              Review or add accomplishments
            </Link>
          </section>
        ) : null}
        {tab === "skills" ? (
          <section className="mt-7">
            <h2 className="font-editorial text-3xl font-semibold">
              Skills supported by this experience
            </h2>
            <div className="mt-5 flex flex-wrap gap-2">
              {record.skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-full border border-forest/15 bg-mint/45 px-4 py-2 text-sm font-bold text-forest"
                >
                  {skill} · supported here
                </span>
              ))}
              {!record.skills.length ? (
                <p className="text-sm text-ink/45">No skills listed yet.</p>
              ) : null}
            </div>
          </section>
        ) : null}
        {tab === "application" ? (
          <section className="mt-7 max-w-3xl">
            <p className="rule-label text-ink/40">Presentation layer</p>
            <h2 className="mt-2 font-editorial text-3xl font-semibold">
              Application versions do not change this record.
            </h2>
            <p className="mt-3 text-sm leading-6 text-ink/50">
              {selected
                ? appVersion
                  ? "A Common App version is saved for this experience."
                  : "This experience is selected, but its application wording is not finished."
                : "This experience is not currently selected for Common App."}
            </p>
            <Link
              href={`/build/application-activities?experience=${encodeURIComponent(record.id)}`}
              className="mt-5 inline-flex min-h-11 items-center rounded-full bg-ink px-4 text-sm font-bold text-white"
            >
              Open Application Activities
            </Link>
          </section>
        ) : null}
        {tab === "history" ? (
          <section className="mt-7 max-w-3xl">
            <h2 className="font-editorial text-3xl font-semibold">
              Role progression
            </h2>
            <div className="mt-5 border-l border-forest/20 pl-5">
              {record.highSchool?.roleHistory.map((role) => (
                <div
                  key={role.id}
                  className="relative border-b border-ink/10 py-5 first:pt-0"
                >
                  <span
                    aria-hidden="true"
                    className="absolute -left-[1.43rem] top-6 h-2 w-2 rounded-full bg-forest first:top-1"
                  />
                  <p className="text-xs font-bold uppercase tracking-[.12em] text-forest">
                    {role.grades.join(" · ") || "Grade not added"}
                  </p>
                  <p className="mt-2 font-editorial text-2xl font-semibold">
                    {role.title}
                  </p>
                </div>
              ))}
              {!record.highSchool?.roleHistory.length ? (
                <p className="text-sm text-ink/45">
                  No role changes recorded yet.
                </p>
              ) : null}
            </div>
          </section>
        ) : null}
        {tab === "passport" ? (
          <section className="mt-7 max-w-3xl rounded-2xl border border-ink/10 bg-[var(--unlocked-surface)] p-6">
            <p className="rule-label text-forest">Conservative privacy</p>
            <h2 className="mt-2 font-editorial text-3xl font-semibold">
              {passportVisible
                ? "Selected for Passport"
                : "Private to your Experience Bank"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-ink/50">
              Passport visibility is a separate choice. Private notes, hours,
              application wording, and admissions use are never published with
              the experience.
            </p>
            <Link
              href="/passport"
              className="mt-5 inline-flex min-h-11 items-center rounded-full border border-forest/20 px-4 text-sm font-bold text-forest"
            >
              Manage Passport visibility
            </Link>
          </section>
        ) : null}
      </div>
    </main>
  );
}
function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--unlocked-surface)] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[.12em] text-ink/38">
        {label}
      </p>
      <p className="mt-2 text-sm font-bold">{value}</p>
    </div>
  );
}
