"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { College } from "@/lib/colleges";
import {
  collegeApplicationPlanLabels,
  collegeApplicationPlans,
  collegeDecisionLabels,
  collegeDecisionOutcomes,
  collegePriorityOptions,
  collegeRequirementStatusLabels,
  collegeRequirementStatuses,
  type CollegeAdmissionsTask,
  type CollegeListRecord,
  type CollegeRequirement,
  type VerifiedCollegeAdmissions,
} from "@/data/college-admissions";
import { writingStatusLabels, type WritingStatus } from "@/data/writing";

const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
export function CollegeApplicationWorkspace({
  college,
  initialRecord,
  verified,
  applicationActivitiesReady = false,
  writing = [],
}: {
  college: College;
  initialRecord: CollegeListRecord;
  verified?: VerifiedCollegeAdmissions;
  applicationActivitiesReady?: boolean;
  writing?: Array<{ id: string; title: string; status: WritingStatus; wordCount: number; wordLimit?: number }>;
}) {
  const [record, setRecord] = useState(initialRecord);
  const [tab, setTab] = useState("overview");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const app = record.application ?? {
    plan: "unknown" as const,
    status: "planning" as const,
    requirements: [],
    tasks: [],
    version: 0,
    updatedAt: record.updatedAt,
  };
  const selectedDeadline = verified?.deadlines.find(
    (item) => item.plan === app.plan,
  );
  const requirements = app.requirements;
  const openTasks = app.tasks.filter((task) => !task.completed);
  const nextAction =
    app.plan === "unknown"
      ? { label: "Choose an application plan", tab: "overview" }
      : requirements.some((item) => item.status === "needs_verification")
        ? { label: "Review what is required", tab: "requirements" }
        : openTasks.length
          ? { label: openTasks[0].title, tab: "tasks" }
          : app.status === "applied"
            ? { label: "Record a decision when it arrives", tab: "decision" }
            : { label: "Add your next application task", tab: "tasks" };
  async function mutate(body: Record<string, unknown>) {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/college-admissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collegeId: college.id, ...body }),
      });
      const data = (await response.json()) as {
        error?: string;
        savedColleges?: CollegeListRecord[];
      };
      if (!response.ok || !data.savedColleges)
        throw new Error(data.error ?? "Update failed");
      setRecord(
        data.savedColleges.find((item) => item.collegeId === college.id)!,
      );
      setMessage("Saved");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not save this update.",
      );
    } finally {
      setPending(false);
    }
  }
  const timeline = useMemo(
    () =>
      [
        ...(verified?.deadlines ?? [])
          .filter(
            (item) =>
              item.plan === app.plan ||
              item.plan === "financial_aid" ||
              item.plan === "enrollment",
          )
          .map((item) => ({
            id: item.id,
            date: item.date,
            title: item.label,
            source: `Official · ${item.cycle}`,
          })),
        ...app.tasks
          .filter((task) => task.dueDate)
          .map((task) => ({
            id: task.id,
            date: task.dueDate!,
            title: task.title,
            source: "Your planning date",
          })),
      ].sort((a, b) => a.date.localeCompare(b.date)),
    [verified, app.plan, app.tasks],
  );
  return (
    <main className="min-h-screen px-5 pb-28 pt-10 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <nav className="text-xs font-bold text-ink/40">
          <Link href="/colleges/saved" className="hover:text-forest">
            My College List
          </Link>
          <span className="px-2">/</span>
          {college.name}
        </nav>
        <Link href="/admissions/counselor" className="mt-4 inline-flex text-sm font-bold text-forest">← Application Counselor</Link>
        <header className="mt-6 rounded-[2rem] border border-ink/10 bg-[var(--unlocked-surface)] p-6 shadow-soft sm:p-9">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="rule-label text-forest">Application workspace</p>
              <h1 className="mt-3 font-editorial text-4xl font-semibold leading-tight sm:text-5xl">
                {college.name}
              </h1>
              <p className="mt-3 text-sm text-ink/50">
                {college.city}, {college.state} · Private to your account
              </p>
            </div>
            <div className="rounded-xl bg-mint/55 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[.12em] text-forest">
                Status
              </p>
              <p className="mt-1 text-sm font-bold text-[var(--unlocked-text)]">
                {app.status.replaceAll("_", " ")}
              </p>
            </div>
          </div>
          <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-ink/10 bg-ink/10 sm:grid-cols-3">
            <div className="bg-[var(--unlocked-surface)] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[.12em] text-ink/38">
                Application plan
              </p>
              <p className="mt-2 font-bold">
                {collegeApplicationPlanLabels[app.plan]}
              </p>
            </div>
            <div className="bg-[var(--unlocked-surface)] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[.12em] text-ink/38">
                Current deadline
              </p>
              <p className="mt-2 font-bold">
                {selectedDeadline
                  ? dateLabel(selectedDeadline.date)
                  : "Not verified"}
              </p>
            </div>
            <div className="bg-[var(--unlocked-surface)] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[.12em] text-ink/38">
                Open work
              </p>
              <p className="mt-2 font-bold">
                {openTasks.length} task{openTasks.length === 1 ? "" : "s"} ·{" "}
                {
                  requirements.filter(
                    (item) => item.status === "needs_verification",
                  ).length
                }{" "}
                to verify
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTab(nextAction.tab)}
            className="mt-7 flex min-h-14 w-full items-center justify-between rounded-xl bg-ink px-5 text-left text-sm font-bold text-white hover:bg-forest"
          >
            <span>
              <small className="mr-3 uppercase tracking-[.1em] text-white/50">
                Next
              </small>
              {nextAction.label}
            </span>
            <span>→</span>
          </button>
        </header>
        <nav
          aria-label="Application sections"
          className="mt-6 flex gap-1 overflow-x-auto rounded-full border border-ink/10 bg-white/45 p-1"
        >
          {[
            ["overview", "Overview"],
            ["requirements", "Requirements"],
            ["tasks", "Tasks & timeline"],
            ["writing", "Writing"],
            ["decision", "Submission & decision"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-pressed={tab === id}
              className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-bold ${tab === id ? "bg-white text-forest shadow-sm" : "text-ink/45"}`}
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
          <section className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
            <div className="rounded-2xl border border-ink/10 bg-[var(--unlocked-surface)] p-6">
              <h2 className="font-editorial text-3xl font-semibold">
                Your plan
              </h2>
              <label className="mt-5 block text-xs font-bold text-ink/45">
                Application plan
                <select
                  value={app.plan}
                  disabled={pending}
                  onChange={(event) =>
                    mutate({
                      action: "update_college",
                      plan: event.target.value,
                      interestState:
                        event.target.value === "unknown"
                          ? record.interestState
                          : "planning_to_apply",
                    })
                  }
                  className="mt-2 block min-h-12 w-full rounded-xl border border-ink/10 bg-white/70 px-4 text-sm font-bold text-ink"
                >
                  <option value="unknown">Not selected</option>
                  {(
                    verified?.validPlans ??
                    collegeApplicationPlans.filter(
                      (plan) =>
                        !["unknown", "restrictive_early_action"].includes(plan),
                    )
                  ).map((plan) => (
                    <option key={plan} value={plan}>
                      {collegeApplicationPlanLabels[plan]}
                    </option>
                  ))}
                </select>
              </label>
              {verified ? (
                <p className="mt-3 text-xs leading-5 text-ink/42">
                  Plans and dates verified from the official admissions site for
                  the {verified.cycle} cycle on {verified.verifiedAt}.{" "}
                  <a
                    href={verified.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-forest"
                  >
                    Check source ↗
                  </a>
                </p>
              ) : (
                <p className="mt-3 text-xs leading-5 text-ink/42">
                  Current plan options and deadlines have not been verified by
                  UnlockED. Confirm your selection on the official college site.
                </p>
              )}
              <label className="mt-6 block text-xs font-bold text-ink/45">
                Private notes
                <textarea
                  defaultValue={record.notes}
                  onBlur={(event) => {
                    if (event.target.value !== record.notes)
                      void mutate({
                        action: "update_college",
                        notes: event.target.value,
                      });
                  }}
                  placeholder="Campus impressions, questions, or concerns…"
                  className="mt-2 min-h-28 w-full rounded-xl border border-ink/10 bg-white/60 p-3 text-sm leading-6 outline-none focus:border-forest/30"
                />
              </label>
            </div>
            <div className="rounded-2xl border border-ink/10 bg-[var(--unlocked-surface)] p-6">
              <h2 className="font-editorial text-2xl font-semibold">
                What matters to you
              </h2>
              <p className="mt-2 text-xs leading-5 text-ink/45">
                Reflection only. These never become a match score.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {collegePriorityOptions.map((priority) => {
                  const selected = record.priorities.includes(priority);
                  return (
                    <button
                      key={priority}
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        mutate({
                          action: "update_college",
                          priorities: selected
                            ? record.priorities.filter(
                                (item) => item !== priority,
                              )
                            : [...record.priorities, priority],
                        })
                      }
                      aria-pressed={selected}
                      className={`min-h-10 rounded-full px-3 text-xs font-bold ${selected ? "bg-forest text-white" : "border border-ink/10 text-ink/50"}`}
                    >
                      {priority}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}
        {tab === "requirements" ? (
          <Requirements
            requirements={requirements}
            verified={verified}
            applicationActivitiesReady={applicationActivitiesReady}
            pending={pending}
            mutate={mutate}
          />
        ) : null}
        {tab === "tasks" ? (
          <Tasks
            tasks={app.tasks}
            timeline={timeline}
            pending={pending}
            mutate={mutate}
          />
        ) : null}
        {tab === "writing" ? (
          <section className="mt-6 rounded-2xl border border-ink/10 bg-[var(--unlocked-surface)] p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="rule-label text-forest">Application writing</p>
                <h2 className="mt-2 font-editorial text-3xl font-semibold">Essays for {college.name}</h2>
                <p className="mt-2 text-sm leading-6 text-ink/50">Drafts live once in your private Writing workspace. UnlockED does not submit them to the application provider.</p>
              </div>
              <Link href={"/build/writing?college=" + encodeURIComponent(college.id)} className="inline-flex min-h-11 items-center rounded-full bg-ink px-4 text-sm font-bold text-white">Open Writing →</Link>
            </div>
            <div className="mt-5 divide-y divide-ink/10 border-y border-ink/10">
              {writing.length ? writing.map((document) => (
                <Link key={document.id} href={"/build/writing/" + encodeURIComponent(document.id)} className="flex items-center justify-between gap-4 py-4">
                  <span><strong className="block text-sm">{document.title}</strong><small className="mt-1 block text-xs text-ink/45">{document.wordCount}{document.wordLimit ? " / " + document.wordLimit : ""} words</small></span>
                  <span className="text-xs font-bold text-forest">{writingStatusLabels[document.status]} →</span>
                </Link>
              )) : <p className="py-5 text-sm text-ink/45">No writing workspace has been started for this college.</p>}
            </div>
          </section>
        ) : null}
        {tab === "decision" ? (
          <Decision
            record={record}
            pending={pending}
            mutate={mutate}
            applicationUrl={verified?.applicationUrl ?? college.website}
          />
        ) : null}
        <div className="mt-6 grid gap-px overflow-hidden rounded-xl border border-ink/10 bg-ink/10 sm:grid-cols-3">
          {["Recommendations", "Testing"].map(
            (item) => (
              <div key={item} className="bg-[var(--unlocked-surface)] p-4">
                <p className="text-sm font-bold">{item}</p>
                <p className="mt-1 text-xs text-ink/40">
                  Workspace foundation ready
                </p>
              </div>
            ),
          )}
          <Link href={`/cost-aid#colleges`} className="bg-[var(--unlocked-surface)] p-4 hover:text-forest">
            <p className="text-sm font-bold">Financial aid</p>
            <p className="mt-1 text-xs text-ink/40">Review cost, forms, calculator estimate, and offer →</p>
          </Link>
        </div>
      </div>
    </main>
  );
}

function Requirements({
  requirements,
  verified,
  applicationActivitiesReady,
  pending,
  mutate,
}: {
  requirements: CollegeRequirement[];
  verified?: VerifiedCollegeAdmissions;
  applicationActivitiesReady: boolean;
  pending: boolean;
  mutate: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  return (
    <section className="mt-6 rounded-2xl border border-ink/10 bg-[var(--unlocked-surface)] p-6">
      <h2 className="font-editorial text-3xl font-semibold">Requirements</h2>
      <p className="mt-2 text-sm leading-6 text-ink/50">
        A requirement is marked official only when it is backed by the current
        college source. Student additions begin as needing verification.
      </p>
      {verified?.applicationPlatforms?.includes("common_app") ? (
        <Link
          href="/build/application-activities"
          className="mt-5 flex items-center justify-between gap-4 rounded-xl bg-mint/50 p-4"
        >
          <span>
            <strong className="block text-sm">
              Common App activities ·{" "}
              {applicationActivitiesReady ? "Ready" : "Draft"}
            </strong>
            <small className="mt-1 block text-xs text-ink/45">
              Prepared in UnlockED—not submitted to this college.
            </small>
          </span>
          <span className="shrink-0 text-sm font-bold text-forest">Open →</span>
        </Link>
      ) : null}
      <div className="mt-6 divide-y divide-ink/10 border-y border-ink/10">
        {requirements.length ? (
          requirements.map((item) => (
            <div
              key={item.id}
              className="grid gap-3 py-4 sm:grid-cols-[1fr_auto] sm:items-center"
            >
              <div>
                <p className="text-sm font-bold">{item.title}</p>
                <p className="mt-1 text-xs text-ink/40">
                  {item.provenance === "official_verified"
                    ? `Official source · ${item.cycle}`
                    : "Student-added · needs verification"}
                  {item.sourceUrl ? (
                    <>
                      {" "}
                      ·{" "}
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-forest"
                      >
                        source ↗
                      </a>
                    </>
                  ) : null}
                </p>
              </div>
              <select
                aria-label={`Status for ${item.title}`}
                value={item.status}
                disabled={pending}
                onChange={(event) =>
                  mutate({
                    action: "set_requirement",
                    requirementId: item.id,
                    status: event.target.value,
                  })
                }
                className="min-h-11 rounded-xl border border-ink/10 bg-white/70 px-3 text-sm font-bold"
              >
                {collegeRequirementStatuses.map((status) => (
                  <option key={status} value={status}>
                    {collegeRequirementStatusLabels[status]}
                  </option>
                ))}
              </select>
            </div>
          ))
        ) : (
          <p className="py-6 text-sm text-ink/45">
            {verified
              ? "Choose an application plan to load verified requirements."
              : "Current requirements are not verified. Add only what you have confirmed."}
          </p>
        )}
      </div>
      <form
        className="mt-5 flex flex-col gap-2 sm:flex-row"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!title.trim()) return;
          await mutate({ action: "add_requirement", title });
          setTitle("");
        }}
      >
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Add a requirement you found"
          className="min-h-11 flex-1 rounded-xl border border-ink/10 bg-white/60 px-3 text-sm"
        />
        <button
          disabled={pending}
          className="min-h-11 rounded-full bg-ink px-4 text-sm font-bold text-white"
        >
          Add requirement
        </button>
      </form>
    </section>
  );
}

function Tasks({
  tasks,
  timeline,
  pending,
  mutate,
}: {
  tasks: CollegeAdmissionsTask[];
  timeline: Array<{ id: string; date: string; title: string; source: string }>;
  pending: boolean;
  mutate: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  return (
    <section className="mt-6 grid gap-5 lg:grid-cols-2">
      <div className="rounded-2xl border border-ink/10 bg-[var(--unlocked-surface)] p-6">
        <h2 className="font-editorial text-3xl font-semibold">
          Application tasks
        </h2>
        <form
          className="mt-5 grid gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!title.trim()) return;
            await mutate({
              action: "add_task",
              title,
              dueDate: dueDate || undefined,
            });
            setTitle("");
            setDueDate("");
          }}
        >
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Ask Ms. Smith for a recommendation"
            className="min-h-11 rounded-xl border border-ink/10 bg-white/60 px-3 text-sm"
          />
          <div className="flex gap-2">
            <input
              type="date"
              aria-label="Optional task due date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="min-h-11 flex-1 rounded-xl border border-ink/10 bg-white/60 px-3 text-sm"
            />
            <button
              disabled={pending}
              className="min-h-11 rounded-full bg-ink px-4 text-sm font-bold text-white"
            >
              Add
            </button>
          </div>
        </form>
        <div className="mt-5 divide-y divide-ink/10">
          {tasks.map((task) => (
            <label key={task.id} className="flex cursor-pointer gap-3 py-4">
              <input
                type="checkbox"
                checked={task.completed}
                disabled={pending}
                onChange={(event) =>
                  mutate({
                    action: "set_task",
                    taskId: task.id,
                    completed: event.target.checked,
                  })
                }
                className="mt-1 h-4 w-4 accent-forest"
              />
              <span>
                <strong
                  className={`block text-sm ${task.completed ? "text-ink/35 line-through" : "text-[var(--unlocked-text)]"}`}
                >
                  {task.title}
                </strong>
                {task.dueDate ? (
                  <small className="mt-1 block text-xs text-ink/40">
                    Your date · {dateLabel(task.dueDate)}
                  </small>
                ) : null}
              </span>
            </label>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-ink/10 bg-[var(--unlocked-surface)] p-6">
        <h2 className="font-editorial text-3xl font-semibold">Timeline</h2>
        <div className="mt-5 divide-y divide-ink/10">
          {timeline.length ? (
            timeline.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[6rem_1fr] gap-4 py-4"
              >
                <time className="text-xs font-bold text-forest">
                  {dateLabel(item.date)}
                </time>
                <div>
                  <p className="text-sm font-bold">{item.title}</p>
                  <p className="mt-1 text-xs text-ink/40">{item.source}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="py-6 text-sm text-ink/45">
              No verified or personal dates yet.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function Decision({
  record,
  pending,
  mutate,
  applicationUrl,
}: {
  record: CollegeListRecord;
  pending: boolean;
  mutate: (body: Record<string, unknown>) => Promise<void>;
  applicationUrl: string | null;
}) {
  const app = record.application;
  const [submittedAt, setSubmittedAt] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [outcome, setOutcome] = useState("accepted");
  const [receivedAt, setReceivedAt] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const accepted = app?.decision?.outcome === "accepted";
  return (
    <section className="mt-6 grid gap-5 lg:grid-cols-2">
      <div className="rounded-2xl border border-ink/10 bg-[var(--unlocked-surface)] p-6">
        <h2 className="font-editorial text-3xl font-semibold">Submission</h2>
        <p className="mt-2 text-sm leading-6 text-ink/50">
          UnlockED records your work. Your application is submitted on the
          official college platform.
        </p>
        {applicationUrl ? (
          <a
            href={applicationUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex min-h-11 items-center rounded-full border border-forest/20 px-4 text-sm font-bold text-forest"
          >
            Open official application ↗
          </a>
        ) : null}
        <label className="mt-6 block text-xs font-bold text-ink/45">
          Date you submitted
          <input
            type="date"
            value={submittedAt}
            onChange={(event) => setSubmittedAt(event.target.value)}
            className="mt-2 block min-h-11 w-full rounded-xl border border-ink/10 bg-white/60 px-3"
          />
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={() => mutate({ action: "mark_applied", submittedAt })}
          className="mt-3 min-h-11 rounded-full bg-ink px-4 text-sm font-bold text-white"
        >
          Mark as applied
        </button>
        {app?.submittedAt ? (
          <p className="mt-4 text-sm font-bold text-forest">
            Recorded as submitted {dateLabel(app.submittedAt)}
          </p>
        ) : null}
      </div>
      <div className="rounded-2xl border border-ink/10 bg-[var(--unlocked-surface)] p-6">
        <h2 className="font-editorial text-3xl font-semibold">Decision</h2>
        {app?.decision ? (
          <div
            className={`mt-5 rounded-xl p-5 ${accepted ? "bg-mint/70" : "bg-ink/[.04]"}`}
          >
            <p className="text-xs font-bold uppercase tracking-[.12em] text-forest">
              Student reported
            </p>
            <p className="mt-2 font-editorial text-3xl font-semibold">
              {collegeDecisionLabels[app.decision.outcome]}
            </p>
            <p className="mt-2 text-sm text-ink/50">
              Received {dateLabel(app.decision.receivedAt)}
            </p>
            {accepted && app.status !== "committed" ? (
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      "Mark this as the one college you intend to attend? Your educational stage will not change yet.",
                    )
                  )
                    void mutate({ action: "commit" });
                }}
                className="mt-5 min-h-11 rounded-full bg-forest px-4 text-sm font-bold text-white"
              >
                I’m going here
              </button>
            ) : null}
            {app.status === "committed" ? (
              <div className="mt-5 border-t border-forest/15 pt-4">
                <p className="font-bold text-forest">Your intended college</p>
                <p className="mt-1 text-xs leading-5 text-ink/50">
                  When you are ready, you will be able to confirm the transition
                  to Undergraduate UnlockED. Nothing switches automatically.
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <label className="mt-5 block text-xs font-bold text-ink/45">
              Outcome
              <select
                value={outcome}
                onChange={(event) => setOutcome(event.target.value)}
                className="mt-2 block min-h-11 w-full rounded-xl border border-ink/10 bg-white/60 px-3 text-sm"
              >
                {collegeDecisionOutcomes.map((item) => (
                  <option key={item} value={item}>
                    {collegeDecisionLabels[item]}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-xs font-bold text-ink/45">
              Date received
              <input
                type="date"
                value={receivedAt}
                onChange={(event) => setReceivedAt(event.target.value)}
                className="mt-2 block min-h-11 w-full rounded-xl border border-ink/10 bg-white/60 px-3"
              />
            </label>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                mutate({ action: "record_decision", outcome, receivedAt })
              }
              className="mt-3 min-h-11 rounded-full bg-ink px-4 text-sm font-bold text-white"
            >
              Record decision
            </button>
          </>
        )}
      </div>
    </section>
  );
}
