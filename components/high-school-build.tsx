"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  highSchoolActivityCategories,
  highSchoolGrades,
  participationTimings,
} from "@/data/high-school-activities";
import type {
  ResumeExperienceRecord,
  ResumeFact,
  ResumeLabStore,
} from "@/data/resume-lab";

const kindLabels: Record<string, string> = {
  action: "What I actually did",
  responsibility: "Responsibilities",
  creation: "Projects or work completed",
  outcome: "Results or accomplishments",
};
const splitLines = (value: string) =>
  value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
const displayRange = (record: ResumeExperienceRecord) =>
  [
    record.startDate?.slice(0, 7),
    record.current ? "Present" : record.endDate?.slice(0, 7),
  ]
    .filter(Boolean)
    .join(" – ") || "Dates not added";

export function HighSchoolBuild({
  initialStore,
  accomplishmentCount,
}: {
  initialStore: ResumeLabStore;
  accomplishmentCount: number;
}) {
  const [store, setStore] = useState(initialStore);
  const [adding, setAdding] = useState(false);
  const experiences = Object.values(store.experiences).sort((a, b) =>
    (b.startDate ?? b.createdAt).localeCompare(a.startDate ?? a.createdAt),
  );
  const grades = useMemo(
    () =>
      highSchoolGrades.map((grade) => ({
        grade,
        records: experiences.filter((record) =>
          record.highSchool?.grades.includes(grade),
        ),
      })),
    [experiences],
  );
  return (
    <main className="min-h-screen px-5 pb-28 pt-12 sm:px-8 sm:pt-16">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="rule-label text-forest">High School Build</p>
            <h1 className="mt-3 max-w-3xl font-editorial text-5xl font-semibold leading-[1.02] sm:text-6xl">
              Activities &amp; Experiences
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-ink/52">
              A private, factual record of what you have actually done—jobs,
              clubs, projects, sports, responsibilities, research, volunteering,
              and everything else that has shaped your high-school years.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAdding((value) => !value)}
            className="min-h-12 rounded-full bg-ink px-5 text-sm font-bold text-white"
          >
            {adding ? "Close" : "Add Experience"}
          </button>
        </header>
        <nav
          aria-label="Build sections"
          className="mt-9 flex gap-2 overflow-x-auto border-b border-ink/10 pb-4"
        >
          <span className="shrink-0 rounded-full bg-forest px-4 py-3 text-sm font-bold text-white">
            Activities &amp; Experiences
          </span>
          <Link
            href="/accomplishments"
            className="shrink-0 rounded-full px-4 py-3 text-sm font-bold text-ink/45 hover:bg-forest/[.06]"
          >
            Accomplishments · {accomplishmentCount}
          </Link>
          <Link
            href="/build/application-activities"
            className="shrink-0 rounded-full px-4 py-3 text-sm font-bold text-ink/45 hover:bg-forest/[.06]"
          >
            Application Activities
          </Link>
        </nav>
        {adding ? (
          <div className="mt-6">
            <ActivityForm
              store={store}
              onSaved={(next) => {
                setStore(next);
                setAdding(false);
              }}
            />
          </div>
        ) : null}
        {!experiences.length && !adding ? (
          <section className="mt-12 rounded-[2rem] border border-dashed border-ink/15 p-8 text-center sm:p-14">
            <p className="rule-label text-forest">
              Activities &amp; Experiences
            </p>
            <h2 className="mt-3 font-editorial text-3xl font-semibold">
              Keep track of what you’ve actually done.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-ink/50">
              Prestige is not the point. Family responsibilities, paid work,
              projects, creative practice, sports, clubs, and community work all
              belong when they are part of your life.
            </p>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="mt-6 min-h-12 rounded-full bg-ink px-5 text-sm font-bold text-white"
            >
              Add Experience
            </button>
          </section>
        ) : null}
        {experiences.length ? (
          <>
            <section className="mt-8 overflow-hidden rounded-[1.75rem] border border-ink/10 bg-[var(--unlocked-surface)] px-5 shadow-soft sm:px-8">
              {experiences.map((record) => (
                <Link
                  key={record.id}
                  href={`/build/experiences/${encodeURIComponent(record.id)}`}
                  className="grid gap-3 border-t border-ink/10 py-6 first:border-t-0 sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[.13em] text-forest">
                      {record.highSchool?.category ??
                        record.kind.replaceAll("_", " ")}
                    </p>
                    <h2 className="mt-2 font-editorial text-2xl font-semibold">
                      {record.title || "Untitled experience"}
                    </h2>
                    <p className="mt-2 text-sm text-ink/48">
                      {[record.organization, displayRange(record)]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-sm font-bold text-forest">
                      Open workspace →
                    </p>
                    <p className="mt-1 text-xs text-ink/38">
                      {record.facts.filter((fact) => fact.confirmed).length}{" "}
                      confirmed facts · {record.skills.length} skills
                    </p>
                  </div>
                </Link>
              ))}
            </section>
            <section className="mt-8">
              <div className="flex items-end justify-between">
                <div>
                  <p className="rule-label text-ink/40">Experience timeline</p>
                  <h2 className="mt-2 font-editorial text-3xl font-semibold">
                    Your high-school years
                  </h2>
                </div>
                <p className="text-xs text-ink/40">
                  No scores. Just your record.
                </p>
              </div>
              <div className="mt-5 grid gap-px overflow-hidden rounded-2xl border border-ink/10 bg-ink/10 sm:grid-cols-4">
                {grades.map(({ grade, records }) => (
                  <div
                    key={grade}
                    className="min-h-44 bg-[var(--unlocked-surface)] p-5"
                  >
                    <p className="text-xs font-bold uppercase tracking-[.12em] text-forest">
                      {grade} grade
                    </p>
                    <div className="mt-4 space-y-3">
                      {records.map((record) => (
                        <Link
                          key={record.id}
                          href={`/build/experiences/${encodeURIComponent(record.id)}`}
                          className="block text-sm font-bold leading-5 hover:text-forest"
                        >
                          {record.title}
                        </Link>
                      ))}
                      {!records.length ? (
                        <p className="text-xs text-ink/35">Nothing recorded</p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

export function ActivityForm({
  store,
  record,
  onSaved,
}: {
  store: ResumeLabStore;
  record?: ResumeExperienceRecord;
  onSaved: (store: ResumeLabStore) => void;
}) {
  const hs = record?.highSchool;
  const latestRole = hs?.roleHistory.at(-1);
  const [title, setTitle] = useState(record?.title ?? "");
  const [organization, setOrganization] = useState(record?.organization ?? "");
  const [role, setRole] = useState(latestRole?.title ?? "");
  const [category, setCategory] = useState(
    hs?.category ?? "Other meaningful experience",
  );
  const [location, setLocation] = useState(record?.location ?? "");
  const [startDate, setStartDate] = useState(record?.startDate ?? "");
  const [endDate, setEndDate] = useState(record?.endDate ?? "");
  const [current, setCurrent] = useState(record?.current ?? true);
  const [grades, setGrades] = useState<string[]>(hs?.grades ?? []);
  const [timing, setTiming] = useState<string[]>(hs?.participationTiming ?? []);
  const [hours, setHours] = useState(hs?.hoursPerWeek?.toString() ?? "");
  const [weeks, setWeeks] = useState(hs?.weeksPerYear?.toString() ?? "");
  const [skills, setSkills] = useState(record?.skills.join(", ") ?? "");
  const [notes, setNotes] = useState(hs?.privateNotes ?? "");
  const [collaborators, setCollaborators] = useState(hs?.collaborators ?? "");
  const [links, setLinks] = useState(hs?.links.join("\n") ?? "");
  const [importText, setImportText] = useState("");
  const [factText, setFactText] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.keys(kindLabels).map((kind) => [
        kind,
        (record?.facts ?? [])
          .filter((fact) => fact.kind === kind && fact.source !== "import")
          .map((fact) => fact.text)
          .join("\n"),
      ]),
    ),
  );
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const preserved = (record?.facts ?? []).filter(
      (fact) =>
        !Object.hasOwn(kindLabels, fact.kind) ||
        (fact.source === "import" && !importText.trim()),
    );
    const entered: Array<
      Pick<ResumeFact, "kind" | "text" | "confirmed" | "source">
    > = Object.entries(factText).flatMap(([kind, value]) =>
      splitLines(value).map((text) => ({
        kind: kind as ResumeFact["kind"],
        text,
        confirmed: true,
        source: "user" as const,
      })),
    );
    const imported = splitLines(importText).map((text) => ({
      kind: "other" as const,
      text,
      confirmed: false,
      source: "import" as const,
    }));
    const roleHistory = [...(hs?.roleHistory ?? [])];
    if (role.trim() && latestRole?.title !== role.trim())
      roleHistory.push({
        id: "",
        title: role.trim(),
        grades,
        startDate,
        endDate: current ? undefined : endDate,
        createdAt: "",
      });
    try {
      const response = await fetch("/api/high-school-activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_experience",
          expectedVersion: store.version,
          idempotencyKey: `activity-${crypto.randomUUID()}`,
          experienceId: record?.id,
          expectedRecordVersion: record?.version,
          title,
          organization,
          role,
          category,
          location,
          startDate,
          endDate: current ? undefined : endDate,
          current,
          skills: skills
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          facts: [...preserved, ...entered, ...imported],
          highSchool: {
            category,
            grades,
            participationTiming: timing,
            hoursPerWeek: hours === "" ? undefined : Number(hours),
            weeksPerYear: weeks === "" ? undefined : Number(weeks),
            privateNotes: notes,
            collaborators,
            links: splitLines(links),
            roleHistory,
          },
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        store?: ResumeLabStore;
      };
      if (!response.ok || !data.store)
        throw new Error(data.error ?? "Could not save this experience.");
      onSaved(data.store);
      setMessage("Saved");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not save this experience.",
      );
    } finally {
      setPending(false);
    }
  }
  const toggle = (
    value: string,
    values: string[],
    set: (next: string[]) => void,
  ) =>
    set(
      values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value],
    );
  return (
    <form
      onSubmit={submit}
      className="rounded-[1.75rem] border border-ink/10 bg-[var(--unlocked-surface)] p-5 shadow-soft sm:p-8"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="rule-label text-forest">Factual record</p>
          <h2 className="mt-2 font-editorial text-3xl font-semibold">
            {record ? "Edit experience" : "Add an experience"}
          </h2>
        </div>
        <span className="rounded-full bg-mint/55 px-3 py-2 text-xs font-bold text-forest">
          Private
        </span>
      </div>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/48">
        Add what you know. Leave hours, dates, or outcomes unknown when you do
        not know them.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="Activity or experience name">
          <input
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>
        <Field label="Organization (optional)">
          <input
            value={organization}
            onChange={(event) => setOrganization(event.target.value)}
          />
        </Field>
        <Field label="Role or position (optional)">
          <input
            value={role}
            onChange={(event) => setRole(event.target.value)}
          />
        </Field>
        <Field label="Category">
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {highSchoolActivityCategories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </Field>
        <Field label="Start month (optional)">
          <input
            type="month"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </Field>
        <Field label="End month (optional)">
          <input
            type="month"
            disabled={current}
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </Field>
      </div>
      <label className="mt-4 flex min-h-11 items-center gap-3 text-sm font-bold">
        <input
          type="checkbox"
          checked={current}
          onChange={(event) => setCurrent(event.target.checked)}
          className="h-4 w-4 accent-forest"
        />
        Ongoing
      </label>
      <ChoiceGroup
        label="Grades participated"
        options={highSchoolGrades}
        values={grades}
        toggle={(value) => toggle(value, grades, setGrades)}
      />
      <ChoiceGroup
        label="When you participated"
        options={participationTimings}
        values={timing}
        toggle={(value) => toggle(value, timing, setTiming)}
      />
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Hours per week (student-provided)">
          <input
            type="number"
            min="0"
            max="168"
            value={hours}
            onChange={(event) => setHours(event.target.value)}
            placeholder="Unknown is okay"
          />
        </Field>
        <Field label="Weeks per year (student-provided)">
          <input
            type="number"
            min="0"
            max="53"
            value={weeks}
            onChange={(event) => setWeeks(event.target.value)}
            placeholder="Unknown is okay"
          />
        </Field>
      </div>
      <div className="mt-7 border-t border-ink/10 pt-6">
        <h3 className="font-editorial text-2xl font-semibold">
          What did you actually do?
        </h3>
        <p className="mt-2 text-sm text-ink/45">
          One factual item per line. Saving confirms the facts you enter here as
          your own record.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {Object.entries(kindLabels).map(([kind, label]) => (
            <Field key={kind} label={label}>
              <textarea
                rows={4}
                value={factText[kind]}
                onChange={(event) =>
                  setFactText((current) => ({
                    ...current,
                    [kind]: event.target.value,
                  }))
                }
              />
            </Field>
          ))}
        </div>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Skills used (comma separated)">
          <input
            value={skills}
            onChange={(event) => setSkills(event.target.value)}
          />
        </Field>
        <Field label="Location (optional)">
          <input
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          />
        </Field>
        <Field label="Collaborators (optional)">
          <textarea
            rows={3}
            value={collaborators}
            onChange={(event) => setCollaborators(event.target.value)}
          />
        </Field>
        <Field label="Links (one HTTPS link per line)">
          <textarea
            rows={3}
            value={links}
            onChange={(event) => setLinks(event.target.value)}
          />
        </Field>
      </div>
      <Field label="Private notes">
        <textarea
          rows={4}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </Field>
      {!record ? (
        <details className="mt-5 rounded-xl border border-ink/10 p-4">
          <summary className="cursor-pointer text-sm font-bold">
            Paste an existing activity list
          </summary>
          <p className="mt-2 text-xs leading-5 text-ink/45">
            Each non-empty line will be imported as an unconfirmed fact. Review
            it in the activity workspace before relying on it.
          </p>
          <textarea
            rows={5}
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            className="mt-3 w-full rounded-xl border border-ink/10 bg-white/55 p-3 text-sm"
          />
        </details>
      ) : null}
      {message ? (
        <p
          role="status"
          className={`mt-4 text-sm font-bold ${message === "Saved" ? "text-forest" : "text-red-700"}`}
        >
          {message}
        </p>
      ) : null}
      <button
        disabled={pending}
        className="mt-6 min-h-12 rounded-full bg-ink px-6 text-sm font-bold text-white"
      >
        {pending ? "Saving…" : "Save experience"}
      </button>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-bold text-ink/48 [&_input]:mt-2 [&_input]:min-h-12 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-ink/10 [&_input]:bg-white/55 [&_input]:px-3 [&_select]:mt-2 [&_select]:min-h-12 [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:border-ink/10 [&_select]:bg-white/55 [&_select]:px-3 [&_textarea]:mt-2 [&_textarea]:w-full [&_textarea]:rounded-xl [&_textarea]:border [&_textarea]:border-ink/10 [&_textarea]:bg-white/55 [&_textarea]:p-3 [&_textarea]:text-sm">
      {label}
      {children}
    </label>
  );
}
function ChoiceGroup({
  label,
  options,
  values,
  toggle,
}: {
  label: string;
  options: readonly string[];
  values: string[];
  toggle: (value: string) => void;
}) {
  return (
    <fieldset className="mt-5">
      <legend className="text-xs font-bold text-ink/48">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={values.includes(item)}
            onClick={() => toggle(item)}
            className={`min-h-10 rounded-full px-4 text-xs font-bold ${values.includes(item) ? "bg-forest text-white" : "border border-ink/10 text-ink/50"}`}
          >
            {item}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
