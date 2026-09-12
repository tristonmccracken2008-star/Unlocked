"use client";

import Link from "next/link";
import { useState } from "react";
import type { CollegeAdmissionsTask } from "@/data/college-admissions";
import { ArrowIcon } from "./icons";

type Model = ReturnType<
  typeof import("@/lib/admissions-journey").buildAdmissionsJourney
>;
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
export function AdmissionsJourney({
  model,
  generalTasks: initialTasks,
  opportunityPursuits,
  testPlans,
}: {
  model: Model;
  generalTasks: CollegeAdmissionsTask[];
  opportunityPursuits: Array<{
    id: string;
    title: string;
    organization: string;
    status: string;
    deadline: string | null;
  }>;
  testPlans: Array<{ id: string; test: "sat" | "act"; date: string; registrationStatus: string; preparationDate?: string; href?: string }>;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function mutate(body: Record<string, unknown>) {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/college-admissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as {
        error?: string;
        journey?: { tasks: CollegeAdmissionsTask[] };
      };
      if (!response.ok || !data.journey)
        throw new Error(data.error ?? "Update failed");
      setTasks(data.journey.tasks);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save this task.",
      );
    } finally {
      setPending(false);
    }
  }
  const attention = [
    {
      count: model.attention.activities,
      label: "application activities section to prepare",
    },
    {
      count: model.attention.next30Days,
      label: "verified application dates in the next 30 days",
    },
    {
      count: model.attention.noPlan,
      label: "planned applications without a selected plan",
    },
    {
      count: model.attention.needsVerification,
      label: "requirements needing verification",
    },
  ].filter((item) => item.count);
  return (
    <main className="min-h-screen px-5 pb-28 pt-12 sm:px-8 sm:pt-16">
      <div className="mx-auto max-w-6xl">
        <p className="rule-label text-forest">Admissions Journey</p>
        <h1 className="mt-3 max-w-3xl font-editorial text-5xl font-semibold leading-[1.03] sm:text-6xl">
          What should I work on now?
        </h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-ink/52">
          One calm view of your applications, verified dates, and the planning
          commitments you created.
        </p>
        <Link href="/admissions/counselor" className="mt-6 inline-flex min-h-11 items-center rounded-full border border-forest/20 bg-[var(--unlocked-surface)] px-5 text-sm font-bold text-forest">Open Application Counselor <ArrowIcon /></Link>
        {model.items.some(({record})=>Boolean(record.application?.decision))?<Link href="/admissions/decisions" className="mt-6 inline-flex min-h-11 items-center rounded-full bg-forest px-5 text-sm font-bold text-white">Open Decision Season <ArrowIcon /></Link>:null}
        <section className="mt-10 rounded-[2rem] bg-ink p-6 text-white shadow-[0_24px_70px_rgba(43,33,26,.18)] sm:p-9">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-white/45">
            One next action
          </p>
          <div className="mt-4 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <h2 className="max-w-3xl font-editorial text-3xl font-semibold sm:text-4xl">
                {model.nextAction.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/55">
                {model.nextAction.detail}
              </p>
            </div>
            <Link
              href={model.nextAction.href}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-forest"
            >
              Continue <ArrowIcon />
            </Link>
          </div>
        </section>
        <section className="mt-6 grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
          <div className="rounded-2xl border border-ink/10 bg-[var(--unlocked-surface)] p-6">
            <p className="rule-label text-ink/40">Needs attention</p>
            {attention.length ? (
              <div className="mt-4 divide-y divide-ink/10">
                {attention.slice(0, 3).map((item) => (
                  <p key={item.label} className="py-4 text-sm leading-6">
                    <strong className="mr-2 text-forest">{item.count}</strong>
                    {item.label}
                  </p>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-ink/50">
                Nothing is calling for attention right now.
              </p>
            )}
            <Link
              href="/colleges/saved"
              className="mt-4 inline-flex text-sm font-bold text-forest"
            >
              Open My College List →
            </Link>
          </div>
          <div className="rounded-2xl border border-ink/10 bg-[var(--unlocked-surface)] p-6">
            <p className="rule-label text-ink/40">Upcoming timeline</p>
            <div className="mt-4 divide-y divide-ink/10">
              {model.deadlines.slice(0, 4).map((item) => (
                <Link
                  key={item.id}
                  href={`/colleges/${item.college.slug}/application`}
                  className="grid grid-cols-[6rem_1fr] gap-4 py-4"
                >
                  <time className="text-xs font-bold text-forest">
                    {dateLabel(item.date)}
                  </time>
                  <span>
                    <strong className="block text-sm">
                      {item.college.name}
                    </strong>
                    <small className="mt-1 block text-xs text-ink/42">
                      {item.label} · Official {item.cycle}
                    </small>
                  </span>
                </Link>
              ))}
              {testPlans.slice(0, Math.max(0, 4 - model.deadlines.length)).map((item) => (
                <Link key={item.id} href={item.href ?? "/academics"} className="grid grid-cols-[6rem_1fr] gap-4 py-4">
                  <time className="text-xs font-bold text-forest">{dateLabel(item.date)}</time>
                  <span><strong className="block text-sm">{item.test.toUpperCase()}</strong><small className="mt-1 block text-xs text-ink/42">{item.registrationStatus} · Date you added</small></span>
                </Link>
              ))}
              {!model.deadlines.length && !testPlans.length ? (
                <p className="py-4 text-sm text-ink/45">
                  No current verified dates are connected to a selected plan.
                </p>
              ) : null}
            </div>
          </div>
        </section>
        <section
          id="opportunity-pursuits"
          className="mt-6 rounded-2xl border border-ink/10 bg-[var(--unlocked-surface)] p-6"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="rule-label text-ink/40">Opportunity pursuits</p>
              <h2 className="mt-2 font-editorial text-3xl font-semibold">
                Experiences you chose to pursue
              </h2>
            </div>
            <Link href="/opportunities" className="text-sm font-bold text-forest">
              Find opportunities →
            </Link>
          </div>
          {opportunityPursuits.length ? (
            <div className="mt-5 divide-y divide-ink/10 border-y border-ink/10">
              {opportunityPursuits.map((item) => (
                <Link
                  key={item.id}
                  href={`/opportunities/${item.id}`}
                  className="grid gap-3 py-4 sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <span>
                    <strong className="block text-sm">{item.title}</strong>
                    <small className="mt-1 block text-xs text-ink/42">
                      {item.organization} · Opportunity
                    </small>
                  </span>
                  <span className="flex items-center gap-3">
                    {item.deadline ? (
                      <time className="text-xs text-ink/45">
                        {dateLabel(item.deadline)}
                      </time>
                    ) : null}
                    <span className="rounded-full bg-mint/55 px-3 py-1 text-xs font-bold text-forest">
                      {item.status}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-4 max-w-xl text-sm leading-6 text-ink/50">
              Saved college applications and opportunity pursuits stay distinct
              here. Add an opportunity when you intend to work toward it.
            </p>
          )}
        </section>
        <section
          id="general-tasks"
          className="mt-6 rounded-2xl border border-ink/10 bg-[var(--unlocked-surface)] p-6"
        >
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="rule-label text-ink/40">Across applications</p>
              <h2 className="mt-2 font-editorial text-3xl font-semibold">
                Personal planning tasks
              </h2>
            </div>
            <p className="text-xs text-ink/40">
              Your dates—not college deadlines
            </p>
          </div>
          {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
          <form
            className="mt-5 grid gap-2 sm:grid-cols-[1fr_11rem_auto]"
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
              placeholder="e.g. Ask for a recommendation"
              className="min-h-11 rounded-xl border border-ink/10 bg-white/60 px-3 text-sm"
            />
            <input
              type="date"
              aria-label="Optional planning date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="min-h-11 rounded-xl border border-ink/10 bg-white/60 px-3 text-sm"
            />
            <button
              disabled={pending}
              className="min-h-11 rounded-full bg-ink px-5 text-sm font-bold text-white"
            >
              Add task
            </button>
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
                    className={`text-sm ${task.completed ? "text-ink/35 line-through" : ""}`}
                  >
                    {task.title}
                  </strong>
                  {task.dueDate ? (
                    <small className="ml-3 text-xs text-ink/40">
                      Your date · {dateLabel(task.dueDate)}
                    </small>
                  ) : null}
                </span>
              </label>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
