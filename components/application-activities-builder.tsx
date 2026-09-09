"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  commonAppActivitySetId,
  currentCommonAppActivities,
  emptyCommonAppActivitySet,
} from "@/data/high-school-activities";
import type {
  ApplicationActivityVersion,
  ResumeExperienceRecord,
  ResumeLabStore,
} from "@/data/resume-lab";
import { unsupportedActivityClaims } from "@/lib/high-school-activities";

export function ApplicationActivitiesBuilder({
  initialStore,
  initialExperienceId,
}: {
  initialStore: ResumeLabStore;
  initialExperienceId?: string;
}) {
  const [store, setStore] = useState(initialStore);
  const [activeId, setActiveId] = useState(initialExperienceId ?? "");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const experiences = Object.values(store.experiences).sort((a, b) =>
    (a.title ?? "").localeCompare(b.title ?? ""),
  );
  const set =
    store.applicationActivitySets?.[commonAppActivitySetId] ??
    emptyCommonAppActivitySet();
  const selected = set.selectedExperienceIds.flatMap(
    (id) => store.experiences[id] ?? [],
  );
  const active = store.experiences[activeId] ?? selected[0];
  async function mutate(body: Record<string, unknown>) {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/high-school-activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: store.version, ...body }),
      });
      const data = (await response.json()) as {
        error?: string;
        store?: ResumeLabStore;
      };
      if (!response.ok || !data.store)
        throw new Error(
          data.error ?? "Could not update Application Activities.",
        );
      setStore(data.store);
      setMessage("Saved");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not save this update.",
      );
    } finally {
      setPending(false);
    }
  }
  async function move(id: string, direction: -1 | 1) {
    const index = set.selectedExperienceIds.indexOf(id);
    const target = index + direction;
    if (target < 0 || target >= set.selectedExperienceIds.length) return;
    const ids = [...set.selectedExperienceIds];
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await mutate({
      action: "reorder_application_activities",
      experienceIds: ids,
    });
  }
  return (
    <main className="min-h-screen px-5 pb-28 pt-12 sm:px-8 sm:pt-16">
      <div className="mx-auto max-w-6xl">
        <nav className="text-xs font-bold text-ink/40">
          <Link href="/build" className="hover:text-forest">
            High School Build
          </Link>
          <span className="px-2">/</span>Application Activities
        </nav>
        <header className="mt-6 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="rule-label text-forest">
              Presentation layer · {set.cycle}
            </p>
            <h1 className="mt-3 font-editorial text-5xl font-semibold leading-tight">
              Application Activities
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-ink/52">
              Choose, order, and write concise application versions of your
              canonical experiences. Your original facts never change here.
            </p>
          </div>
          <div className="rounded-xl border border-ink/10 bg-[var(--unlocked-surface)] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[.12em] text-ink/40">
              Common App capacity
            </p>
            <p className="mt-1 text-sm font-bold">
              {selected.length} of {set.slotLimit} selected · {set.status}
            </p>
          </div>
        </header>
        <div className="mt-5 rounded-xl bg-mint/45 p-4 text-xs leading-5 text-ink/55">
          Current official guidance allows up to{" "}
          {currentCommonAppActivities.slotLimit} activities and limits position
          to {set.limits.position}, organization to {set.limits.organization},
          and description to {set.limits.description} characters. Unused slots
          are not a problem.{" "}
          <a
            href={set.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="font-bold text-forest"
          >
            Official Common App source ↗
          </a>{" "}
          · Verified {set.verifiedAt}
        </div>
        {message ? (
          <p
            role="status"
            className={`mt-4 text-sm font-bold ${message === "Saved" ? "text-forest" : "text-red-700"}`}
          >
            {message}
          </p>
        ) : null}
        <section className="mt-8 grid gap-6 lg:grid-cols-[.72fr_1.28fr]">
          <div>
            <div className="rounded-2xl border border-ink/10 bg-[var(--unlocked-surface)] p-5">
              <h2 className="font-editorial text-2xl font-semibold">
                Choose your activities
              </h2>
              <p className="mt-2 text-xs leading-5 text-ink/45">
                Selection is entirely yours. UnlockED does not rank experiences.
              </p>
              <div className="mt-4 divide-y divide-ink/10">
                {experiences.map((experience) => {
                  const checked = set.selectedExperienceIds.includes(
                    experience.id,
                  );
                  return (
                    <label
                      key={experience.id}
                      className="flex cursor-pointer gap-3 py-4"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={
                          pending ||
                          (!checked && selected.length >= set.slotLimit)
                        }
                        onChange={(event) => {
                          if (event.target.checked) setActiveId(experience.id);
                          void mutate({
                            action: "toggle_application_activity",
                            experienceId: experience.id,
                            selected: event.target.checked,
                          });
                        }}
                        className="mt-1 h-4 w-4 accent-forest"
                      />
                      <span>
                        <strong className="block text-sm">
                          {experience.title}
                        </strong>
                        <small className="mt-1 block text-xs text-ink/40">
                          {experience.highSchool?.category ??
                            experience.kind.replaceAll("_", " ")}
                        </small>
                      </span>
                    </label>
                  );
                })}
                {!experiences.length ? (
                  <p className="py-5 text-sm text-ink/45">
                    Add an experience before building an application section.
                  </p>
                ) : null}
              </div>
              <Link
                href="/build"
                className="mt-4 inline-flex text-sm font-bold text-forest"
              >
                Add or edit experiences →
              </Link>
            </div>
            {selected.length ? (
              <div className="mt-5 rounded-2xl border border-ink/10 bg-[var(--unlocked-surface)] p-5">
                <h2 className="font-editorial text-2xl font-semibold">
                  Your order
                </h2>
                <p className="mt-2 text-xs text-ink/45">
                  No hidden prestige ordering.
                </p>
                <ol className="mt-4 space-y-2">
                  {selected.map((experience, index) => (
                    <li
                      key={experience.id}
                      className={`flex items-center gap-2 rounded-xl border p-3 ${active?.id === experience.id ? "border-forest/25 bg-mint/35" : "border-ink/10"}`}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveId(experience.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <small className="text-[10px] font-bold text-ink/35">
                          {index + 1}
                        </small>
                        <strong className="ml-2 text-sm">
                          {experience.title}
                        </strong>
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${experience.title} up`}
                        disabled={pending || index === 0}
                        onClick={() => void move(experience.id, -1)}
                        className="h-9 w-9 rounded-full border border-ink/10 disabled:opacity-25"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${experience.title} down`}
                        disabled={pending || index === selected.length - 1}
                        onClick={() => void move(experience.id, 1)}
                        className="h-9 w-9 rounded-full border border-ink/10 disabled:opacity-25"
                      >
                        ↓
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
          <div>
            {active && set.selectedExperienceIds.includes(active.id) ? (
              <ApplicationActivityEditor
                key={`${active.id}:${set.versions[active.id]?.version ?? -1}`}
                experience={active}
                version={set.versions[active.id]}
                limit={set.limits.description}
                pending={pending}
                save={(body) =>
                  mutate({
                    action: "save_application_activity",
                    experienceId: active.id,
                    ...body,
                  })
                }
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-ink/15 p-10 text-center">
                <h2 className="font-editorial text-3xl font-semibold">
                  Select an experience to begin.
                </h2>
                <p className="mt-3 text-sm text-ink/45">
                  The application version will reference confirmed facts without
                  replacing them.
                </p>
              </div>
            )}
          </div>
        </section>
        <section className="mt-8 flex flex-wrap items-center justify-between gap-5 border-t border-ink/10 pt-6">
          <div>
            <p className="text-sm font-bold">
              Section status: {set.status === "ready" ? "Ready" : "Draft"}
            </p>
            <p className="mt-1 text-xs text-ink/42">
              Ready means prepared in UnlockED—not submitted to Common App or a
              college.
            </p>
          </div>
          <button
            type="button"
            disabled={pending || !selected.length}
            onClick={() =>
              void mutate({
                action: "set_application_activities_status",
                status: set.status === "ready" ? "draft" : "ready",
              })
            }
            className="min-h-11 rounded-full bg-ink px-5 text-sm font-bold text-white disabled:opacity-40"
          >
            Mark {set.status === "ready" ? "as draft" : "ready"}
          </button>
        </section>
      </div>
    </main>
  );
}

function ApplicationActivityEditor({
  experience,
  version,
  limit,
  pending,
  save,
}: {
  experience: ResumeExperienceRecord;
  version?: ApplicationActivityVersion;
  limit: number;
  pending: boolean;
  save: (body: Record<string, unknown>) => Promise<void>;
}) {
  const hs = experience.highSchool;
  const [activityType, setActivityType] = useState(
    version?.activityType ?? hs?.category ?? "Other",
  );
  const [position, setPosition] = useState(
    version?.position ?? hs?.roleHistory.at(-1)?.title ?? "",
  );
  const [organization, setOrganization] = useState(
    version?.organization ?? experience.organization ?? "",
  );
  const [description, setDescription] = useState(version?.description ?? "");
  const [continueInCollege, setContinueInCollege] = useState(
    version?.continueInCollege,
  );
  const unsupported = unsupportedActivityClaims(description, experience);
  const confirmed = experience.facts.filter((fact) => fact.confirmed);
  const unusedFacts = useMemo(
    () =>
      confirmed
        .filter(
          (fact) =>
            !description.toLowerCase().includes(fact.text.toLowerCase()),
        )
        .slice(0, 3),
    [confirmed, description],
  );
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        await save({
          activityType,
          position,
          organization,
          description,
          grades: hs?.grades ?? [],
          participationTiming: hs?.participationTiming ?? [],
          hoursPerWeek: hs?.hoursPerWeek,
          weeksPerYear: hs?.weeksPerYear,
          continueInCollege,
        });
      }}
      className="rounded-[1.75rem] border border-ink/10 bg-[var(--unlocked-surface)] p-5 shadow-soft sm:p-7"
    >
      <p className="rule-label text-forest">Application version</p>
      <h2 className="mt-2 font-editorial text-3xl font-semibold">
        {experience.title}
      </h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <EditorField label="Activity type" count={`${activityType.length}`}>
          <input
            value={activityType}
            onChange={(event) => setActivityType(event.target.value)}
          />
        </EditorField>
        <EditorField
          label="Position / leadership"
          count={`${position.length} / 50`}
        >
          <input
            maxLength={50}
            value={position}
            onChange={(event) => setPosition(event.target.value)}
          />
        </EditorField>
        <div className="sm:col-span-2">
          <EditorField
            label="Organization"
            count={`${organization.length} / 100`}
          >
            <input
              maxLength={100}
              value={organization}
              onChange={(event) => setOrganization(event.target.value)}
            />
          </EditorField>
        </div>
      </div>
      <div className="mt-5">
        <EditorField
          label="Activity details, honors, and accomplishments"
          count={`${description.length} / ${limit}`}
        >
          <textarea
            rows={6}
            maxLength={limit}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </EditorField>
      </div>
      <div
        className={`mt-4 rounded-xl p-4 ${unsupported.length ? "bg-amber-50 text-amber-950" : "bg-mint/45"}`}
      >
        <p className="text-xs font-bold">Evidence review</p>
        {unsupported.length ? (
          <p className="mt-1 text-xs leading-5">
            Unsupported numeric claim{unsupported.length === 1 ? "" : "s"}:{" "}
            {unsupported.join(", ")}. Add the fact to the canonical experience
            or remove it.
          </p>
        ) : (
          <p className="mt-1 text-xs leading-5 text-ink/50">
            No unsupported numeric claims detected. This check never invents or
            silently rewrites facts.
          </p>
        )}
      </div>
      <div className="mt-4 rounded-xl border border-ink/10 p-4">
        <p className="text-xs font-bold">Confirmed facts you can reference</p>
        <ul className="mt-2 space-y-2 text-xs leading-5 text-ink/55">
          {confirmed.slice(0, 8).map((fact) => (
            <li key={fact.id}>• {fact.text}</li>
          ))}
          {!confirmed.length ? (
            <li>
              No confirmed facts yet. Return to the experience and add what you
              know.
            </li>
          ) : null}
        </ul>
        {unusedFacts.length && description.length ? (
          <p className="mt-3 border-t border-ink/10 pt-3 text-xs text-forest">
            You have {limit - description.length} characters available. A
            recorded fact not currently referenced: “{unusedFacts[0].text}”
          </p>
        ) : null}
      </div>
      <dl className="mt-5 grid gap-3 rounded-xl bg-ink/[.035] p-4 text-xs sm:grid-cols-2">
        <div>
          <dt className="font-bold text-ink/40">Grades</dt>
          <dd className="mt-1">{hs?.grades.join(", ") || "Unknown"}</dd>
        </div>
        <div>
          <dt className="font-bold text-ink/40">Time provided by you</dt>
          <dd className="mt-1">
            {hs?.hoursPerWeek ?? "Unknown"} hr/week ·{" "}
            {hs?.weeksPerYear ?? "Unknown"} weeks/year
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-ink/40">
        Update these factual values in the canonical experience—not in the
        application wording.
      </p>
      <fieldset className="mt-5">
        <legend className="text-xs font-bold text-ink/45">
          Intend to participate in college? (optional)
        </legend>
        <div className="mt-2 flex gap-2">
          {([true, false] as const).map((value) => (
            <button
              key={String(value)}
              type="button"
              aria-pressed={continueInCollege === value}
              onClick={() =>
                setContinueInCollege(
                  continueInCollege === value ? undefined : value,
                )
              }
              className={`min-h-10 rounded-full px-4 text-xs font-bold ${continueInCollege === value ? "bg-forest text-white" : "border border-ink/10"}`}
            >
              {value ? "Yes" : "No"}
            </button>
          ))}
        </div>
      </fieldset>
      {version?.revisions.length ? (
        <details className="mt-5 border-t border-ink/10 pt-4">
          <summary className="cursor-pointer text-sm font-bold">
            Compare earlier versions ({version.revisions.length})
          </summary>
          <div className="mt-3 space-y-3">
            {version.revisions
              .slice()
              .reverse()
              .map((revision) => (
                <div key={revision.id} className="rounded-xl bg-ink/[.035] p-4">
                  <p className="text-xs text-ink/40">
                    {new Date(revision.updatedAt).toLocaleDateString()}
                  </p>
                  <p className="mt-2 text-sm">
                    {revision.description || "No description"}
                  </p>
                </div>
              ))}
          </div>
        </details>
      ) : null}
      <button
        disabled={pending || Boolean(unsupported.length)}
        className="mt-6 min-h-12 rounded-full bg-ink px-6 text-sm font-bold text-white disabled:opacity-40"
      >
        Save application version
      </button>
    </form>
  );
}
function EditorField({
  label,
  count,
  children,
}: {
  label: string;
  count: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-bold text-ink/48">
      <span className="flex justify-between gap-3">
        <span>{label}</span>
        <span className="tabular-nums text-ink/35">{count}</span>
      </span>
      <span className="mt-2 block [&_input]:min-h-12 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-ink/10 [&_input]:bg-white/55 [&_input]:px-3 [&_textarea]:w-full [&_textarea]:rounded-xl [&_textarea]:border [&_textarea]:border-ink/10 [&_textarea]:bg-white/55 [&_textarea]:p-3 [&_textarea]:text-sm">
        {children}
      </span>
    </label>
  );
}
