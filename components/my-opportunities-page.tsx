"use client";

import Link from "next/link";
import type { ReactElement, ReactNode } from "react";
import { memo, useEffect, useMemo, useState } from "react";
import { deadlineLabel, type Opportunity } from "@/data/opportunities";
import { opportunityTrackerStatuses, persistStudentActivity, readStudentActivity, removeTrackedOpportunity, replaceStudentActivity, studentActivityEvent, updateOpportunityStatus, type OpportunityTrackerStatus, type StudentActivity } from "@/data/student-activity";
import { readAccountSession } from "@/data/account-sync";
import { buildCollegeJourneySummary, type CollegeJourneySummary, type JourneyTimeRange } from "@/data/journey";
import { schools } from "@/data/seed";
import { readCompletedStudentProfile, type StudentProfile } from "@/data/student-profile";
import type { AccountSession } from "@/lib/account-types";
import { isProUser } from "@/lib/billing";
import { canShowFounderBadge, canUseReferralJourneyThemes } from "@/lib/referrals";
import { ArrowIcon, BookmarkIcon, CheckCircleIcon, CheckIcon, HeartIcon, MoreIcon, MoveIcon, PenLineIcon, SendIcon, SparkIcon, TargetIcon, TrophyIcon, XCircleIcon } from "./icons";
import { OrganizationLogo } from "./organization-logo";
import { trackProductEvent } from "@/data/product-analytics";

const filters = ["All", "Scholarships", "AI Tools", "Research", "Internships", "Benefits", "Software"] as const;
type TrackerFilter = (typeof filters)[number];
type Toast = { tone: "success" | "error"; message: string };
type Milestone = { title: string; why: string; date: string; opportunityTitle?: string };
type BoardItem = { opportunity: Opportunity; record: NonNullable<StudentActivity["tracked"]>[string] };
type IconComponent = (props: { className?: string }) => ReactElement;
type ShareTheme = "forest" | "charcoal" | "cream";
type ShareFormat = "story" | "square";
type ShareOptions = {
  format: ShareFormat;
  theme: ShareTheme;
  showSchool: boolean;
  showMajor: boolean;
  showMilestones: boolean;
  showOpportunityNames: boolean;
  range: JourneyTimeRange;
};

const statusMeta: Record<OpportunityTrackerStatus, { Icon: IconComponent; description: string; accent: string; soft: string; border: string }> = {
  Saved: { Icon: BookmarkIcon, description: "Ready when you are.", accent: "text-forest", soft: "bg-forest/8", border: "border-forest" },
  Interested: { Icon: HeartIcon, description: "Worth a closer look.", accent: "text-rose-700", soft: "bg-rose-50", border: "border-rose-300" },
  Applying: { Icon: PenLineIcon, description: "Application in motion.", accent: "text-amber-700", soft: "bg-amber-50", border: "border-amber-400" },
  Submitted: { Icon: SendIcon, description: "Sent and tracked.", accent: "text-blue-700", soft: "bg-blue-50", border: "border-blue-400" },
  Interview: { Icon: TargetIcon, description: "Preparing for conversation.", accent: "text-violet-700", soft: "bg-violet-50", border: "border-violet-400" },
  Accepted: { Icon: CheckCircleIcon, description: "Good news to build on.", accent: "text-emerald-700", soft: "bg-emerald-50", border: "border-emerald-500" },
  Rejected: { Icon: XCircleIcon, description: "Closed, but still useful.", accent: "text-red-700", soft: "bg-red-50", border: "border-red-300" },
  Completed: { Icon: TrophyIcon, description: "Finished and resume-ready.", accent: "text-forest", soft: "bg-forest/8", border: "border-forest" },
};

const summaryStatuses: OpportunityTrackerStatus[] = ["Submitted", "Interview", "Accepted", "Completed"];

function timingLabel(item: Opportunity) {
  return item.application_deadline ? deadlineLabel(item) : item.metadata.deadlineType === "rolling" ? "Rolling deadline" : deadlineLabel(item);
}

function matchesFilter(item: Opportunity, filter: TrackerFilter) {
  if (filter === "All") return true;
  if (filter === "Scholarships") return item.type === "Scholarship";
  if (filter === "AI Tools") return item.type === "AI";
  if (filter === "Research") return item.type === "Research";
  if (filter === "Internships") return item.type === "Career" && item.category === "Internships";
  if (filter === "Benefits") return item.type === "Benefit";
  return item.category === "Software" || item.tags.some((tag) => tag.toLowerCase().includes("software"));
}

function statusSummary(status: OpportunityTrackerStatus) {
  if (status === "Interested") return "Interested";
  if (status === "Applying") return "Applying";
  if (status === "Interview") return "Interviewing";
  return status;
}

function milestoneFor(status: OpportunityTrackerStatus, before: StudentActivity, after: StudentActivity, opportunity?: Opportunity): Milestone | null {
  const previous = Object.values(before.tracked ?? {});
  const next = Object.values(after.tracked ?? {});
  const date = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const title = opportunity?.title;
  if (status === "Submitted" && !previous.some((item) => ["Submitted", "Interview", "Accepted", "Rejected", "Completed"].includes(item.status))) return { title: "First application submitted", why: "You moved from saving opportunities to actively applying.", date, opportunityTitle: title };
  if (status === "Interview" && !previous.some((item) => item.status === "Interview")) return { title: "First interview recorded", why: "Interview activity creates stronger stories and clearer next steps.", date, opportunityTitle: title };
  if (status === "Accepted" && !previous.some((item) => item.status === "Accepted")) return { title: "First acceptance recorded", why: "This is real progress you can build on in your Journey.", date, opportunityTitle: title };
  if (status === "Completed" && !previous.some((item) => item.status === "Completed")) return { title: "First opportunity completed", why: "Completed opportunities turn interest into evidence.", date, opportunityTitle: title };
  if (next.filter((item) => ["Submitted", "Interview", "Accepted", "Rejected", "Completed"].includes(item.status)).length >= 5 && previous.filter((item) => ["Submitted", "Interview", "Accepted", "Rejected", "Completed"].includes(item.status)).length < 5) return { title: "Five applications tracked", why: "You are building a real application rhythm.", date, opportunityTitle: title };
  if (next.length >= 10 && previous.length < 10) return { title: "Ten opportunities tracked", why: "Your board now reflects a serious opportunity search.", date, opportunityTitle: title };
  return null;
}

function filterCounts(items: BoardItem[]) {
  return Object.fromEntries(filters.map((filter) => [filter, filter === "All" ? items.length : items.filter(({ opportunity }) => matchesFilter(opportunity, filter)).length])) as Record<TrackerFilter, number>;
}

export function MyOpportunitiesPage() {
  const [activity, setActivity] = useState<StudentActivity>({ viewed: [], saved: [], claimed: [], tracked: {} });
  const [opportunitiesById, setOpportunitiesById] = useState<Record<string, Opportunity>>({});
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [session, setSession] = useState<AccountSession | null>(null);
  const [filter, setFilter] = useState<TrackerFilter>("All");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [cardOpen, setCardOpen] = useState(false);

  useEffect(() => {
    const update = () => setActivity(readStudentActivity());
    update();
    trackProductEvent("journey_board_opened");
    window.addEventListener(studentActivityEvent, update);
    return () => window.removeEventListener(studentActivityEvent, update);
  }, []);

  useEffect(() => {
    let active = true;
    setProfile(readCompletedStudentProfile());
    readAccountSession().then((next) => {
      if (!active) return;
      setSession(next);
      setProfile(next.data?.profile ?? readCompletedStudentProfile());
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const ids = Object.keys(activity.tracked ?? {});
    if (!ids.length) { setOpportunitiesById({}); return; }
    let active = true;
    fetch(`/api/opportunities?ids=${encodeURIComponent(ids.join(","))}`).then((response) => response.ok ? response.json() : Promise.reject()).then((body: { opportunities: Opportunity[] }) => {
      if (active) setOpportunitiesById(Object.fromEntries(body.opportunities.map((item) => [item.id, item])));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [activity.tracked]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!profile) return;
    trackProductEvent("college_journey_summary_viewed");
  }, [profile]);
  useEffect(() => {
    if (!milestone) return;
    trackProductEvent("milestone_share_prompt_viewed", { milestoneTitle: milestone.title });
  }, [milestone]);

  const allItems = useMemo(() => {
    const tracked = activity.tracked ?? {};
    return Object.values(tracked).map((record) => {
      const opportunity = opportunitiesById[record.id];
      return opportunity ? { opportunity, record } : null;
    }).filter((item): item is BoardItem => Boolean(item)).sort((a, b) => b.record.updatedAt.localeCompare(a.record.updatedAt) || a.opportunity.title.localeCompare(b.opportunity.title));
  }, [activity.tracked, opportunitiesById]);

  const visibleItems = useMemo(() => allItems.filter(({ opportunity }) => matchesFilter(opportunity, filter)), [allItems, filter]);
  const byStatus = useMemo(() => Object.fromEntries(opportunityTrackerStatuses.map((status) => [status, visibleItems.filter(({ record }) => record.status === status)])) as Record<OpportunityTrackerStatus, BoardItem[]>, [visibleItems]);
  const counts = useMemo(() => filterCounts(allItems), [allItems]);
  const statusCounts = useMemo(() => Object.fromEntries(opportunityTrackerStatuses.map((status) => [status, Object.values(activity.tracked ?? {}).filter((record) => record.status === status).length])) as Record<OpportunityTrackerStatus, number>, [activity.tracked]);
  const collegeJourney = useMemo(() => profile ? buildCollegeJourneySummary({ profile, activity, opportunities: Object.values(opportunitiesById) }) : null, [activity, opportunitiesById, profile]);

  async function moveOpportunity(opportunity: Opportunity, nextStatus: OpportunityTrackerStatus, source: "menu" | "drag") {
    const previous = readStudentActivity();
    const next = updateOpportunityStatus(opportunity.id, nextStatus, false);
    setActivity(next);
    setOpenMenu(null);
    setToast({ tone: "success", message: `Moved to ${nextStatus}` });
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(12);
    trackProductEvent(source === "drag" ? "opportunity_drag_completed" : "opportunity_status_changed", { opportunityId: opportunity.id, status: nextStatus });
    trackProductEvent("status_changed", { opportunityId: opportunity.id, status: nextStatus });
    if (["Applying", "Submitted", "Interview", "Accepted", "Rejected", "Completed"].includes(nextStatus)) trackProductEvent("application_recorded", { opportunityId: opportunity.id, status: nextStatus });
    const unlocked = milestoneFor(nextStatus, previous, next, opportunity);
    if (unlocked) {
      setMilestone(unlocked);
      trackProductEvent("milestone_unlocked", { opportunityId: opportunity.id, status: nextStatus, milestoneTitle: unlocked.title });
    }
    try {
      await persistStudentActivity(next);
    } catch {
      replaceStudentActivity(previous);
      setActivity(previous);
      setToast({ tone: "error", message: "Could not save that move. Restored the previous status." });
      if (source === "drag") trackProductEvent("opportunity_drag_failed", { opportunityId: opportunity.id, status: nextStatus });
    }
  }

  function remove(opportunity: Opportunity) {
    removeTrackedOpportunity(opportunity.id);
    setToast({ tone: "success", message: "Removed from Journey Board" });
  }

  function changeFilter(next: TrackerFilter) {
    setFilter(next);
    trackProductEvent("journey_filter_changed", { filterName: "journey_board", filterValue: next });
  }

  return <section className="bg-[radial-gradient(circle_at_top_left,rgba(231,216,189,.45),transparent_34rem),#f6f0e6] px-5 py-10 sm:px-8 sm:py-14">
    <div className="mx-auto max-w-[112rem]">
      <header className="grid gap-8 border-b border-ink/10 pb-10 lg:grid-cols-[minmax(0,1fr)_660px] lg:items-end">
        <div>
          <p className="rule-label text-forest">Personal opportunity tracker</p>
          <h1 className="mt-3 font-editorial text-5xl font-bold leading-[.94] tracking-[-.05em] text-forest sm:text-7xl">Journey Board</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-ink/58">Manage opportunities, move them through your pipeline, and keep every next step in one calm place.</p>
          <p className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-full bg-white/70 px-4 text-sm font-bold text-forest shadow-[0_10px_30px_rgba(43,33,26,.05)] ring-1 ring-ink/8"><CheckIcon className="h-4 w-4"/> All changes save automatically</p>
        </div>
        <div className="grid overflow-hidden rounded-[1.4rem] bg-white/90 shadow-[0_22px_70px_rgba(43,33,26,.08)] ring-1 ring-ink/8 sm:grid-cols-4">
          {summaryStatuses.map((status) => <SummaryCard key={status} label={statusSummary(status)} value={statusCounts[status]} status={status} />)}
        </div>
      </header>

      {collegeJourney && profile ? <CollegeJourneySummaryPanel summary={collegeJourney} profile={profile} session={session} openCard={() => { setCardOpen(true); trackProductEvent("journey_card_generator_opened"); }} /> : null}

      <div className="mt-6" aria-label="Filter saved opportunities">
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
          {filters.map((item) => <button key={item} type="button" onClick={() => changeFilter(item)} className={`inline-flex min-h-12 shrink-0 items-center gap-3 rounded-xl border px-5 text-sm font-bold shadow-[0_8px_24px_rgba(43,33,26,.04)] transition duration-200 focus:outline-none focus:ring-2 focus:ring-forest/40 ${filter === item ? "border-forest bg-forest text-white shadow-[0_16px_34px_rgba(31,95,67,.18)]" : "border-ink/10 bg-white/82 text-ink hover:-translate-y-0.5 hover:border-forest/25 hover:text-forest motion-reduce:hover:translate-y-0"}`}>{item}<span className={`rounded-md px-2 py-1 text-xs ${filter === item ? "bg-white/18 text-white" : "bg-forest/8 text-forest"}`}>{counts[item]}</span></button>)}
        </div>
      </div>

      {allItems.length ? <div className="mt-7 overflow-x-auto pb-6 [scrollbar-gutter:stable]" data-journey-board-scroll>
        <div className="grid grid-flow-col auto-cols-[minmax(16rem,17.5rem)] gap-5" data-journey-board-lanes>
          {opportunityTrackerStatuses.map((status) => <Lane key={status} status={status} items={byStatus[status]} openMenu={openMenu} setOpenMenu={setOpenMenu} moveOpportunity={moveOpportunity} remove={remove} draggingId={draggingId} setDraggingId={setDraggingId} />)}
        </div>
        <StatusLegend />
      </div> : <div className="mt-10 rounded-[2rem] bg-white px-6 py-16 text-center shadow-soft ring-1 ring-ink/8">
        <p className="font-editorial text-3xl font-bold">Your board is ready.</p>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink/50">Save an opportunity from Discover and it will appear here with a clear next step.</p>
        <Link href="/opportunities" className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-6 text-sm font-bold text-white hover:bg-forest">Open Discover <ArrowIcon/></Link>
      </div>}
    </div>
    <div aria-live="polite" className="sr-only">{toast?.message}</div>
    {toast && <div role="status" className={`fixed bottom-24 left-5 right-5 z-50 rounded-2xl px-5 py-4 text-sm font-bold shadow-soft sm:left-auto sm:right-6 sm:w-96 ${toast.tone === "success" ? "bg-forest text-white" : "bg-red-700 text-white"}`}>{toast.message}</div>}
    {milestone && <MilestonePanel milestone={milestone} openCard={() => { setMilestone(null); setCardOpen(true); trackProductEvent("milestone_share_prompt_clicked", { milestoneTitle: milestone.title }); }} close={() => setMilestone(null)} />}
    {cardOpen && collegeJourney && profile ? <JourneyCardModal baseSummary={collegeJourney} profile={profile} activity={activity} session={session} opportunitiesById={opportunitiesById} close={() => setCardOpen(false)} /> : null}
  </section>;
}

function studentFullName(profile: StudentProfile, session: AccountSession | null) {
  const profileName = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
  return profileName || session?.user?.name || profile.firstName || "UnlockED student";
}

function initialsFor(profile: StudentProfile, session: AccountSession | null) {
  return studentFullName(profile, session).split(" ").map((part) => part[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "U";
}

function schoolNameFor(profile: StudentProfile) {
  return schools.find((school) => school.slug === profile.schoolSlug)?.name ?? "Your school";
}

function safeClassYear(profile: StudentProfile) {
  return profile.graduationYear ? `Class of ${profile.graduationYear}` : profile.year;
}

function CollegeJourneySummaryPanel({ summary, profile, session, openCard }: { summary: CollegeJourneySummary; profile: StudentProfile; session: AccountSession | null; openCard: () => void }) {
  const next = summary.nextMilestone;
  return <section className="mt-8 rounded-[1.6rem] bg-white/78 p-5 shadow-[0_16px_48px_rgba(43,33,26,.06)] ring-1 ring-ink/8 sm:p-6" aria-labelledby="college-journey-heading">
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
      <div>
        <p className="rule-label text-forest">College Journey</p>
        <h2 id="college-journey-heading" className="mt-2 font-editorial text-3xl font-bold tracking-[-.03em] text-ink">Your progress, ready to share.</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/56">Milestones update from real saves, applications, interviews, acceptances, and completions.</p>
      </div>
      <button type="button" onClick={openCard} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-forest px-6 text-sm font-bold text-white shadow-[0_16px_34px_rgba(31,95,67,.18)] hover:bg-ink focus:outline-none focus:ring-2 focus:ring-forest/35"><SparkIcon className="h-4 w-4"/> Generate Journey Card</button>
    </div>
    <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="text-sm font-black text-ink">{summary.completedCount} of {summary.applicableCount} milestones completed</p>
          <p className="text-xs font-bold text-ink/45">{summary.progressPercent}% complete</p>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-paper ring-1 ring-ink/7" role="progressbar" aria-valuenow={summary.completedCount} aria-valuemin={0} aria-valuemax={summary.applicableCount} aria-label="College Journey milestone progress">
          <div className="h-full rounded-full bg-forest transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${summary.progressPercent}%` }} />
        </div>
        <p className="mt-3 text-sm leading-6 text-ink/56">{next ? <>Next milestone: <span className="font-bold text-ink">{next.title}</span></> : "You completed every available milestone in the current catalog."}</p>
      </div>
      <div className="rounded-2xl bg-paper/70 px-4 py-3 text-sm leading-6 text-ink/58">
        <span className="font-black text-forest">{studentFullName(profile, session).split(" ")[0] || "Your"} recap</span>
        <span className="block">Top category: {summary.topCategory ?? "Not enough activity yet"}</span>
      </div>
    </div>
  </section>;
}

const shareThemes: Record<ShareTheme, { name: string; background: string; panel: string; text: string; muted: string; accent: string }> = {
  forest: { name: "Forest", background: "#063f2b", panel: "#f6f0e6", text: "#f6f0e6", muted: "#d9cdbb", accent: "#d6a64f" },
  charcoal: { name: "Charcoal", background: "#211a16", panel: "#f6f0e6", text: "#f6f0e6", muted: "#d9cdbb", accent: "#73b78d" },
  cream: { name: "Cream", background: "#f6f0e6", panel: "#0b5a3d", text: "#211a16", muted: "#5f554c", accent: "#0b5a3d" },
};

function JourneyCardModal({ baseSummary, profile, activity, session, opportunitiesById, close }: { baseSummary: CollegeJourneySummary; profile: StudentProfile; activity: StudentActivity; session: AccountSession | null; opportunitiesById: Record<string, Opportunity>; close: () => void }) {
  const [options, setOptions] = useState<ShareOptions>({ format: "story", theme: "forest", showSchool: true, showMajor: true, showMilestones: true, showOpportunityNames: false, range: "all" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pro = isProUser(session?.data?.billing);
  const referralThemes = canUseReferralJourneyThemes(session?.data?.referrals);
  const premiumThemeSelected = options.theme !== "forest" && !(pro || referralThemes);
  const summary = useMemo(() => options.range === "all" ? baseSummary : buildCollegeJourneySummary({ profile, activity, opportunities: Object.values(opportunitiesById), range: options.range }), [activity, baseSummary, opportunitiesById, options.range, profile]);
  const svg = useMemo(() => journeyCardSvg({ summary, profile, session, options, opportunitiesById }), [opportunitiesById, options, profile, session, summary]);
  const previewUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const dimensions = options.format === "story" ? { width: 1080, height: 1920 } : { width: 1080, height: 1080 };

  async function imageBlob() {
    const image = new Image();
    image.decoding = "async";
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Card preview could not be rendered."));
        image.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas export is not available.");
      context.drawImage(image, 0, 0, dimensions.width, dimensions.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 1));
      if (!blob) throw new Error("PNG export failed.");
      trackProductEvent("journey_card_generated", { filterValue: options.format });
      return blob;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function download() {
    setBusy(true);
    setMessage("");
    try {
      if (premiumThemeSelected) throw new Error("Premium Journey Card themes require UnlockED Pro or a referral reward.");
      const blob = await imageBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `unlocked-college-journey-${options.format}.png`;
      link.click();
      URL.revokeObjectURL(url);
      trackProductEvent("journey_card_downloaded", { filterValue: options.format });
      setMessage("Journey Card downloaded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not download the card.");
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    setBusy(true);
    setMessage("");
    trackProductEvent("journey_card_share_started", { filterValue: options.format });
    try {
      if (premiumThemeSelected) throw new Error("Premium Journey Card themes require UnlockED Pro or a referral reward.");
      const blob = await imageBlob();
      const file = new File([blob], `unlocked-college-journey-${options.format}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: "My UnlockED College Journey", text: "My college journey is building on UnlockED.", url: "https://unlockededu.com", files: [file] });
        trackProductEvent("journey_card_share_completed", { filterValue: options.format });
        setMessage("Share sheet opened.");
      } else {
        await navigator.clipboard?.writeText("https://unlockededu.com");
        trackProductEvent("journey_card_copy_link_clicked");
        setMessage("Sharing is not available here, so the UnlockED link was copied.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") setMessage("Share canceled.");
      else setMessage("Could not open sharing. You can still download the card.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/45 px-4 py-6 backdrop-blur-sm sm:px-6" role="dialog" aria-modal="true" aria-labelledby="journey-card-title">
    <section className="mx-auto grid w-full max-w-6xl gap-5 rounded-[2rem] bg-paper p-5 shadow-[0_34px_100px_rgba(43,33,26,.32)] ring-1 ring-white/40 lg:grid-cols-[minmax(0,1fr)_22rem] lg:p-7">
      <div>
        <div className="flex items-start justify-between gap-4">
          <div><p className="rule-label text-forest">Share Your Journey</p><h2 id="journey-card-title" className="mt-2 font-editorial text-4xl font-bold tracking-[-.035em]">Create your Journey Card</h2><p className="mt-2 max-w-xl text-sm leading-6 text-ink/56">This preview uses your name, class year, selected profile fields, and real Journey totals. GPA, email, private notes, and rejected opportunities are never included.</p></div>
          <button type="button" onClick={close} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-ink/10 bg-white text-xl text-ink/50 hover:border-forest hover:text-forest" aria-label="Close Journey Card generator">×</button>
        </div>
        <div className="mt-6 grid place-items-center rounded-[1.5rem] bg-white/62 p-4 ring-1 ring-ink/7">
          <img src={previewUrl} alt="Preview of your UnlockED Journey Card" className={`max-h-[70vh] w-auto rounded-[1.25rem] shadow-[0_22px_70px_rgba(43,33,26,.16)] ${options.format === "story" ? "aspect-[9/16]" : "aspect-square"}`} style={{ maxWidth: "100%" }} />
        </div>
      </div>
      <aside className="space-y-5">
        <div className="rounded-[1.35rem] bg-white/78 p-4 ring-1 ring-ink/8">
          <h3 className="font-editorial text-2xl font-bold">Privacy preview</h3>
          <p className="mt-2 text-sm leading-6 text-ink/56">This card includes your name, class year, activity totals, and any optional fields you keep visible.</p>
          <div className="mt-4 space-y-3 text-sm font-bold text-ink/70">
            <Toggle checked={options.showSchool} label="Show school" onChange={(value) => setOptions((current) => ({ ...current, showSchool: value }))} />
            <Toggle checked={options.showMajor} label="Show major" onChange={(value) => setOptions((current) => ({ ...current, showMajor: value }))} />
            <Toggle checked={options.showMilestones} label="Show milestones" onChange={(value) => setOptions((current) => ({ ...current, showMilestones: value }))} />
            <Toggle checked={options.showOpportunityNames} label="Show opportunity names" onChange={(value) => setOptions((current) => ({ ...current, showOpportunityNames: value }))} />
          </div>
        </div>
        <ControlGroup label="Format">{(["story", "square"] as ShareFormat[]).map((format) => <button key={format} type="button" onClick={() => { setOptions((current) => ({ ...current, format })); trackProductEvent("journey_card_format_changed", { filterValue: format }); }} className={`min-h-10 rounded-full px-4 text-sm font-bold capitalize ${options.format === format ? "bg-forest text-white" : "bg-white text-ink/60 ring-1 ring-ink/10"}`}>{format === "story" ? "Story 9:16" : "Square"}</button>)}</ControlGroup>
        <ControlGroup label="Theme">{(Object.keys(shareThemes) as ShareTheme[]).map((theme) => {
          const premium = theme !== "forest";
          return <button key={theme} type="button" onClick={() => { setOptions((current) => ({ ...current, theme })); trackProductEvent(premium ? "premium_theme_previewed" : "journey_card_theme_changed", { filterValue: theme }); if (premium && !(pro || referralThemes)) setMessage("Premium themes can be previewed, but export requires Pro or a referral reward."); else trackProductEvent("premium_journey_theme_selected", { filterValue: theme }); }} className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-bold ${options.theme === theme ? "bg-forest text-white" : "bg-white text-ink/60 ring-1 ring-ink/10"}`}><span className="h-3 w-3 rounded-full" style={{ background: shareThemes[theme].background }} />{shareThemes[theme].name}{premium && !referralThemes ? " · Pro" : premium ? " · Unlocked" : ""}</button>;
        })}</ControlGroup>
        <ControlGroup label="Range">{(["all", "semester", "academicYear"] as JourneyTimeRange[]).map((range) => <button key={range} type="button" onClick={() => setOptions((current) => ({ ...current, range }))} className={`min-h-10 rounded-full px-4 text-sm font-bold ${options.range === range ? "bg-forest text-white" : "bg-white text-ink/60 ring-1 ring-ink/10"}`}>{range === "all" ? "All time" : range === "semester" ? "This semester" : "Academic year"}</button>)}</ControlGroup>
        <div className="rounded-[1.35rem] bg-white/78 p-4 text-sm leading-6 text-ink/56 ring-1 ring-ink/8">
          <p className="font-black text-ink">Real data only</p>
          <p className="mt-1">{summary.completedCount} of {summary.applicableCount} milestones completed. {summary.activityHeatmap.length ? `${summary.activityHeatmap.length} active ${summary.activityHeatmap.length === 1 ? "day" : "days"} in this range.` : "No activity dates in this range yet."}</p>
        </div>
        <div className="space-y-3">
          <button type="button" disabled={busy} onClick={share} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-forest px-5 text-sm font-bold text-white hover:bg-ink disabled:opacity-55">Share Card <ArrowIcon /></button>
          <button type="button" disabled={busy} onClick={download} className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-forest/35 bg-white px-5 text-sm font-bold text-forest hover:border-forest disabled:opacity-55">Download PNG</button>
          {premiumThemeSelected && <Link href="/pricing" onClick={() => trackProductEvent("premium_theme_upgrade_clicked", { filterValue: options.theme })} className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-ink/15 px-5 text-sm font-bold text-ink/60 hover:border-forest hover:text-forest">Unlock premium themes</Link>}
        </div>
        <p role="status" className="min-h-6 text-sm font-bold text-forest">{message}</p>
      </aside>
    </section>
  </div>;
}

function ControlGroup({ label, children }: { label: string; children: ReactNode }) {
  return <div className="rounded-[1.35rem] bg-white/62 p-4 ring-1 ring-ink/8"><p className="mb-3 text-xs font-black uppercase tracking-[.14em] text-ink/40">{label}</p><div className="flex flex-wrap gap-2">{children}</div></div>;
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return <label className="flex cursor-pointer items-center justify-between gap-4"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => { onChange(event.target.checked); trackProductEvent("journey_card_privacy_changed", { filterName: label, filterValue: event.target.checked ? "visible" : "hidden" }); }} className="h-5 w-5 accent-forest" /></label>;
}

function escapeSvg(value: string | null | undefined) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function shortDate(value: string | null) {
  if (!value) return "Not started";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function journeyCardSvg({ summary, profile, session, options, opportunitiesById }: { summary: CollegeJourneySummary; profile: StudentProfile; session: AccountSession | null; options: ShareOptions; opportunitiesById: Record<string, Opportunity> }) {
  const theme = shareThemes[options.theme];
  const story = options.format === "story";
  const width = 1080;
  const height = story ? 1920 : 1080;
  const name = escapeSvg(studentFullName(profile, session));
  const school = escapeSvg(options.showSchool ? schoolNameFor(profile) : "");
  const major = escapeSvg(options.showMajor ? profile.major : "");
  const classYear = escapeSvg(safeClassYear(profile));
  const topCategory = escapeSvg(summary.topCategory ?? "Building");
  const topInterest = escapeSvg(summary.topInterest ?? "Exploring");
  const founderBadge = canShowFounderBadge(session?.data?.referrals);
  const milestones = summary.completedMilestones.filter((item) => item.shareable).slice(0, story ? 4 : 3);
  const milestoneText = milestones.length ? milestones.map((item, index) => `<text x="96" y="${story ? 1270 + index * 70 : 742 + index * 55}" fill="${theme.text}" font-size="${story ? 32 : 24}" font-weight="700">${escapeSvg(item.title)}</text>`).join("") : `<text x="96" y="${story ? 1270 : 742}" fill="${theme.muted}" font-size="${story ? 32 : 24}" font-weight="700">First milestone coming soon</text>`;
  const subtitle = [school, major, classYear].filter(Boolean).join(" • ");
  const progressWidth = Math.max(8, Math.round((summary.progressPercent / 100) * 720));
  const opportunityNames = options.showOpportunityNames ? summary.completedMilestones.map((item) => item.relatedOpportunityId ? opportunitiesById[item.relatedOpportunityId]?.title : "").filter(Boolean).slice(0, 2).join(" · ") : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" rx="${story ? 72 : 56}" fill="${theme.background}"/>
  <circle cx="${story ? 920 : 920}" cy="160" r="180" fill="${theme.accent}" opacity=".14"/>
  <circle cx="130" cy="${story ? 1720 : 930}" r="210" fill="${theme.panel}" opacity=".08"/>
  <text x="80" y="118" fill="${theme.accent}" font-size="24" font-weight="900" letter-spacing="8">MY COLLEGE JOURNEY</text>
  <rect x="80" y="170" width="150" height="150" rx="75" fill="${theme.panel}" opacity=".96"/>
  <text x="155" y="265" text-anchor="middle" fill="${theme.background}" font-size="56" font-weight="900">${escapeSvg(initialsFor(profile, session))}</text>
  <text x="260" y="225" fill="${theme.text}" font-size="${story ? 56 : 46}" font-family="Georgia, serif" font-weight="800">${name}</text>
  <text x="260" y="280" fill="${theme.muted}" font-size="${story ? 30 : 24}" font-weight="600">${escapeSvg(subtitle)}</text>
  ${founderBadge ? `<rect x="${story ? 790 : 800}" y="208" width="160" height="48" rx="24" fill="${theme.accent}" opacity=".95"/><text x="${story ? 870 : 880}" y="239" text-anchor="middle" fill="${theme.background}" font-size="18" font-weight="900" letter-spacing="3">FOUNDER</text>` : ""}
  <line x1="80" x2="1000" y1="${story ? 405 : 360}" y2="${story ? 405 : 360}" stroke="${theme.muted}" opacity=".25"/>
  <text x="96" y="${story ? 520 : 445}" fill="${theme.muted}" font-size="${story ? 28 : 22}" font-weight="800">Opportunities saved</text>
  <text x="940" y="${story ? 520 : 445}" text-anchor="end" fill="${theme.text}" font-size="${story ? 58 : 44}" font-family="Georgia, serif" font-weight="800">${summary.recap.opportunitiesSaved}</text>
  <text x="96" y="${story ? 640 : 525}" fill="${theme.muted}" font-size="${story ? 28 : 22}" font-weight="800">Applications submitted</text>
  <text x="940" y="${story ? 640 : 525}" text-anchor="end" fill="${theme.text}" font-size="${story ? 58 : 44}" font-family="Georgia, serif" font-weight="800">${summary.recap.applicationsSubmitted}</text>
  <text x="96" y="${story ? 760 : 605}" fill="${theme.muted}" font-size="${story ? 28 : 22}" font-weight="800">Interviews</text>
  <text x="940" y="${story ? 760 : 605}" text-anchor="end" fill="${theme.text}" font-size="${story ? 58 : 44}" font-family="Georgia, serif" font-weight="800">${summary.recap.interviewsReached}</text>
  <text x="96" y="${story ? 880 : 685}" fill="${theme.muted}" font-size="${story ? 28 : 22}" font-weight="800">Accepted or completed</text>
  <text x="940" y="${story ? 880 : 685}" text-anchor="end" fill="${theme.text}" font-size="${story ? 58 : 44}" font-family="Georgia, serif" font-weight="800">${summary.recap.acceptancesRecorded}</text>
  <rect x="80" y="${story ? 965 : 765}" width="920" height="${story ? 220 : 130}" rx="34" fill="${theme.panel}" opacity=".96"/>
  <text x="120" y="${story ? 1038 : 815}" fill="${theme.background}" font-size="${story ? 26 : 20}" font-weight="900" letter-spacing="4">TOP CATEGORY</text>
  <text x="120" y="${story ? 1100 : 870}" fill="${theme.background}" font-size="${story ? 48 : 34}" font-family="Georgia, serif" font-weight="800">${topCategory}</text>
  <text x="${story ? 120 : 600}" y="${story ? 1165 : 815}" fill="${theme.background}" font-size="${story ? 26 : 20}" font-weight="900" letter-spacing="4">TOP INTEREST</text>
  <text x="${story ? 120 : 600}" y="${story ? 1225 : 870}" fill="${theme.background}" font-size="${story ? 48 : 34}" font-family="Georgia, serif" font-weight="800">${topInterest}</text>
  ${options.showMilestones ? `<text x="80" y="${story ? 1350 : 745}" fill="${theme.accent}" font-size="${story ? 24 : 18}" font-weight="900" letter-spacing="6">MILESTONES</text>${milestoneText}` : ""}
  ${opportunityNames ? `<text x="80" y="${story ? 1585 : 940}" fill="${theme.muted}" font-size="${story ? 24 : 18}" font-weight="700">${escapeSvg(opportunityNames)}</text>` : ""}
  <text x="80" y="${story ? 1670 : 942}" fill="${theme.muted}" font-size="${story ? 28 : 20}" font-weight="700">Journey started ${escapeSvg(shortDate(summary.journeyStartDate))}</text>
  <rect x="80" y="${story ? 1715 : 970}" width="720" height="18" rx="9" fill="${theme.panel}" opacity=".28"/>
  <rect x="80" y="${story ? 1715 : 970}" width="${progressWidth}" height="18" rx="9" fill="${theme.accent}"/>
  <text x="820" y="${story ? 1738 : 988}" fill="${theme.text}" font-size="${story ? 28 : 20}" font-weight="900">${summary.completedCount}/${summary.applicableCount}</text>
  <text x="80" y="${story ? 1810 : 1030}" fill="${theme.text}" font-size="${story ? 34 : 24}" font-family="Georgia, serif" font-weight="800">Keep building. Your future is unlocking.</text>
  <text x="80" y="${story ? 1865 : 1060}" fill="${theme.accent}" font-size="${story ? 26 : 18}" font-weight="900">unlockededu.com</text>
</svg>`;
}

function SummaryCard({ label, value, status }: { label: string; value: number; status: OpportunityTrackerStatus }) {
  const { Icon, soft, accent } = statusMeta[status];
  return <section className="flex min-h-32 flex-col items-start justify-center gap-5 border-ink/8 p-5 text-left sm:border-r sm:last:border-r-0">
    <span className="flex w-full items-center justify-between gap-4"><span className="text-xs font-black text-ink/70">{label}</span><span className={`grid h-9 w-9 place-items-center rounded-full ${soft} ${accent}`}><Icon className="h-[18px] w-[18px]"/></span></span>
    <span className="font-editorial text-5xl font-bold leading-none text-forest">{value}</span>
  </section>;
}

function Lane({ status, items, openMenu, setOpenMenu, moveOpportunity, remove, draggingId, setDraggingId }: { status: OpportunityTrackerStatus; items: BoardItem[]; openMenu: string | null; setOpenMenu: (id: string | null) => void; moveOpportunity: (opportunity: Opportunity, status: OpportunityTrackerStatus, source: "menu" | "drag") => void; remove: (opportunity: Opportunity) => void; draggingId: string | null; setDraggingId: (id: string | null) => void }) {
  const activeDrop = Boolean(draggingId);
  const { Icon, accent, border, soft } = statusMeta[status];
  return <section className="min-w-0" data-journey-lane onDragOver={(event) => { if (draggingId) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); const id = event.dataTransfer.getData("text/plain"); setDraggingId(null); const opportunity = window.__unlockedDraggedOpportunity; window.__unlockedDraggedOpportunity = undefined; if (!id || items.some(({ opportunity: item }) => item.id === id)) return; if (opportunity?.id) void moveOpportunity(opportunity, status, "drag"); else trackProductEvent("opportunity_drag_failed", { opportunityId: id, status }); }}>
    <div className={`mb-3 rounded-t-2xl border-b-2 bg-white/55 px-4 py-4 shadow-[0_8px_24px_rgba(43,33,26,.035)] ${items.length ? border : "border-ink/10"}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-black text-ink"><span className={`grid h-8 w-8 place-items-center rounded-full ${soft} ${accent}`} aria-hidden><Icon className="h-[18px] w-[18px]"/></span>{statusSummary(status)}</h2>
        <span className="rounded-lg bg-paper px-2.5 py-1 text-xs font-black text-ink/50">{items.length}</span>
      </div>
    </div>
    <div className={`min-h-80 rounded-[1.25rem] border border-dashed p-2 transition duration-200 ${activeDrop ? "border-forest/40 bg-forest/[.035]" : "border-transparent"}`}>
      {items.length ? <div className="space-y-4">{items.map(({ opportunity, record }) => <TrackedCard key={opportunity.id} opportunity={opportunity} status={record.status} open={openMenu === opportunity.id} setOpen={(open) => setOpenMenu(open ? opportunity.id : null)} moveOpportunity={moveOpportunity} remove={remove} setDraggingId={setDraggingId} />)}</div> : <EmptyLane status={status} />}
    </div>
  </section>;
}

declare global {
  interface Window { __unlockedDraggedOpportunity?: Opportunity }
}

const TrackedCard = memo(function TrackedCard({ opportunity, status, open, setOpen, moveOpportunity, remove, setDraggingId }: { opportunity: Opportunity; status: OpportunityTrackerStatus; open: boolean; setOpen: (open: boolean) => void; moveOpportunity: (opportunity: Opportunity, status: OpportunityTrackerStatus, source: "menu" | "drag") => void; remove: (opportunity: Opportunity) => void; setDraggingId: (id: string | null) => void }) {
  const nextStatuses = opportunityTrackerStatuses.filter((item) => item !== status);
  const { Icon, accent, soft } = statusMeta[status];
  return <article data-opportunity-id={opportunity.id} data-opportunity-title={opportunity.title} data-journey-card draggable onDragStart={(event) => { window.__unlockedDraggedOpportunity = opportunity; event.dataTransfer.setData("text/plain", opportunity.id); event.dataTransfer.effectAllowed = "move"; setDraggingId(opportunity.id); trackProductEvent("opportunity_drag_started", { opportunityId: opportunity.id, status }); }} onDragEnd={() => { setDraggingId(null); window.__unlockedDraggedOpportunity = undefined; }} className="group min-h-[13.75rem] rounded-[1.25rem] bg-white/95 p-4 shadow-[0_14px_36px_rgba(43,33,26,.075)] ring-1 ring-ink/7 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_48px_rgba(43,33,26,.11)] focus-within:ring-2 focus-within:ring-forest/30 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
    <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-start gap-3">
      <OrganizationLogo opportunity={opportunity} size="sm"/>
      <div className="min-w-0">
        <p className="truncate text-[10px] font-black uppercase tracking-[.14em] text-forest">{opportunity.type}</p>
        <h3 className="mt-1.5 font-editorial text-lg font-bold leading-[1.08] tracking-[-.015em]"><Link href={`/opportunities/${opportunity.id}`} className="line-clamp-2 rounded-sm hover:text-forest focus:outline-none focus:ring-2 focus:ring-forest/30">{opportunity.title}</Link></h3>
        <p className="mt-2 line-clamp-1 text-xs font-bold text-ink/42">{opportunity.organization}</p>
      </div>
      <button type="button" onClick={() => remove(opportunity)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink/35 hover:bg-paper hover:text-ink focus:outline-none focus:ring-2 focus:ring-forest/30" aria-label={`Remove ${opportunity.title}`}><MoreIcon className="h-4 w-4"/></button>
    </div>
    <dl className="mt-4 space-y-2 text-xs">
      <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3"><dt className="text-ink/46">Timing</dt><dd className="min-w-0 truncate text-right font-black">{timingLabel(opportunity)}</dd></div>
      <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3"><dt className="text-ink/46">Status</dt><dd className={`min-w-0 truncate text-right font-black ${accent}`}>{statusSummary(status)}</dd></div>
    </dl>
    <div className="relative mt-4">
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => { setOpen(!open); if (!open) trackProductEvent("opportunity_status_menu_opened", { opportunityId: opportunity.id, status }); }} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-forest/35 bg-white px-3 text-sm font-black text-forest shadow-[0_8px_22px_rgba(43,33,26,.045)] transition duration-200 hover:border-forest hover:bg-forest hover:text-white hover:shadow-[0_14px_30px_rgba(31,95,67,.16)] focus:outline-none focus:ring-2 focus:ring-forest/35"><MoveIcon/> Move to... <span aria-hidden className={`transition duration-200 ${open ? "rotate-180" : ""}`}>⌄</span></button>
      {open && <div role="menu" className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-2xl border border-ink/10 bg-white/95 p-2 shadow-[0_24px_70px_rgba(43,33,26,.2)] backdrop-blur">
        <p className="px-3 pb-2 pt-1 text-[11px] font-black uppercase tracking-[.14em] text-ink/35">Move to</p>
        {nextStatuses.map((item) => {
          const next = statusMeta[item];
          const NextIcon = next.Icon;
          return <button key={item} role="menuitem" type="button" onClick={() => void moveOpportunity(opportunity, item, "menu")} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-sm font-bold text-ink transition hover:bg-paper focus:bg-paper focus:outline-none">
            <span className="flex min-w-0 items-center gap-2"><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${next.soft} ${next.accent}`}><NextIcon className="h-3.5 w-3.5"/></span>{statusSummary(item)}</span>
            <span className="truncate text-xs font-bold text-ink/35">{next.description}</span>
          </button>;
        })}
      </div>}
    </div>
  </article>;
});

function StatusLegend() {
  return <div className="mt-5 flex min-w-[1120px] items-center justify-center gap-7 rounded-full bg-white/45 px-5 py-3 text-xs font-bold text-ink/45 ring-1 ring-ink/6">
    {opportunityTrackerStatuses.map((status) => {
      const { Icon, accent } = statusMeta[status];
      return <span key={status} className="inline-flex items-center gap-2"><Icon className={`h-4 w-4 ${accent}`}/>{statusSummary(status)}</span>;
    })}
  </div>;
}

function EmptyLane({ status }: { status: OpportunityTrackerStatus }) {
  const { Icon, accent, soft } = statusMeta[status];
  return <div className="flex min-h-64 flex-col items-center justify-center rounded-[1.25rem] border border-dashed border-ink/14 bg-white/35 px-5 text-center text-sm text-ink/50">
    <div className={`mb-4 grid h-12 w-12 place-items-center rounded-full ${soft} ${accent}`}><Icon className="h-5 w-5"/></div>
    <p className="font-bold text-ink/65">No opportunities here yet.</p>
    <p className="mt-2 max-w-36 text-xs leading-5">{statusMeta[status].description}</p>
  </div>;
}

function MilestonePanel({ milestone, openCard, close }: { milestone: Milestone; openCard: () => void; close: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-ink/35 px-5" role="dialog" aria-modal="true" aria-labelledby="milestone-title">
    <section className="w-full max-w-lg rounded-[2rem] bg-paper p-7 shadow-[0_30px_90px_rgba(43,33,26,.28)]">
      <p className="rule-label text-forest">Milestone unlocked</p>
      <h2 id="milestone-title" className="mt-3 font-editorial text-4xl font-bold tracking-[-.035em] text-forest">{milestone.title}</h2>
      <p className="mt-4 text-sm leading-7 text-ink/60">{milestone.why}</p>
      {milestone.opportunityTitle && <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-ink/70">{milestone.opportunityTitle}</p>}
      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink/35">{milestone.date}</p>
      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={openCard} className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-forest px-5 text-sm font-bold text-white hover:bg-ink">Generate card</button>
        <button type="button" onClick={close} className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full border border-ink/15 px-5 text-sm font-bold text-ink/60 hover:border-forest hover:text-forest">Keep tracking</button>
      </div>
    </section>
  </div>;
}
