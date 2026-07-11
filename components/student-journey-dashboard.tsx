"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { schools, type School } from "@/data/seed";
import { advisorProfileUpdatedMessageKey, type StudentProfile } from "@/data/student-profile";
import type { AccountSession } from "@/lib/account-types";
import { deadlineLabel, opportunities, type Opportunity } from "@/data/opportunities";
import { readStudentActivity, studentActivityEvent, type StudentActivity, type OpportunityTrackerStatus, type TrackedOpportunity } from "@/data/student-activity";
import { trackProductEvent } from "@/data/product-analytics";
import { inferApplicationsFromActivity, readStudentProgress, studentProgressEvent, type StudentProgress } from "@/data/student-progress";
import { buildRecommendationService, type RecommendationViewModel } from "@/data/recommendation-service";
import { buildJourneyMilestones, buildJourneyRecap, journeyActiveStatuses, type JourneyMilestone, type JourneyRecap } from "@/data/journey";
import { ArrowIcon, BookmarkIcon, CheckCircleIcon, PenLineIcon, SendIcon, TargetIcon, TrophyIcon } from "./icons";
import { OrganizationLogo } from "./organization-logo";

type TimelineItem = JourneyMilestone | { id: string; title: string; description: string; category: JourneyMilestone["category"]; future: true; href?: string };
type IconComponent = (props: { className?: string }) => React.ReactElement;
type CatalogOpportunity = (typeof opportunities)[number];
type ActiveOpportunity = { record: TrackedOpportunity; opportunity: CatalogOpportunity };

const activeStatusSet = new Set<OpportunityTrackerStatus>(journeyActiveStatuses);
const statusCopy: Record<OpportunityTrackerStatus, string> = {
  Saved: "Saved",
  Interested: "Interested",
  Applying: "Applying",
  Submitted: "Submitted",
  Interview: "Interviewing",
  Accepted: "Accepted",
  Rejected: "Rejected",
  Completed: "Completed",
};
const categoryIcons: Record<JourneyMilestone["category"], IconComponent> = {
  Profile: PenLineIcon,
  Saved: BookmarkIcon,
  Application: SendIcon,
  Interview: TargetIcon,
  Accepted: CheckCircleIcon,
  Completed: TrophyIcon,
};

function displayName(profile: StudentProfile, session: AccountSession | null) {
  return profile.firstName?.trim() || session?.user?.name?.split(" ")[0] || "there";
}

function displayFullName(profile: StudentProfile, session: AccountSession | null) {
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
  return name || session?.user?.name || displayName(profile, session);
}

function profileTags(profile: StudentProfile) {
  return [...new Set([
    ...(profile.preferredOpportunityTypes ?? []),
    ...(profile.advisorInterview?.preferredOpportunityTypes ?? []),
    ...profile.interests.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 3),
  ])].slice(0, 4);
}

function compactDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit", timeZone: "UTC" }).format(new Date(value));
}

function recapHeadline(firstName: string, recap: JourneyRecap) {
  if (recap.completedOpportunities > 0) return `${firstName} completed an opportunity.`;
  if (recap.acceptancesRecorded > 0) return `${firstName} reached a major milestone.`;
  if (recap.interviewsReached > 0) return `${firstName}'s applications are moving forward.`;
  if (recap.applicationsSubmitted > 0) return `${firstName} is building momentum.`;
  if (recap.opportunitiesSaved > 0) return `${firstName}'s journey is taking shape.`;
  return `${firstName}'s journey is just beginning.`;
}

function futureMilestones(recap: JourneyRecap): TimelineItem[] {
  const items: TimelineItem[] = [];
  if (recap.applicationsSubmitted === 0) items.push({ id: "future-apply", title: "Take the next step", description: "Move a saved opportunity into application progress.", category: "Application", future: true, href: "/my-opportunities" });
  if (recap.interviewsReached === 0) items.push({ id: "future-interview", title: "Land your first interview", description: "Interview milestones appear when you track an opportunity as interviewing.", category: "Interview", future: true, href: "/my-opportunities" });
  if (recap.acceptancesRecorded === 0) items.push({ id: "future-acceptance", title: "Celebrate your first acceptance", description: "Acceptances are recorded from your Journey Board status.", category: "Accepted", future: true, href: "/my-opportunities" });
  return items.slice(0, 3);
}

export function StudentDashboard({ profile, session, syncError }: { profile: StudentProfile; session: AccountSession | null; syncError: string }) {
  const [activity, setActivity] = useState<StudentActivity>({ viewed: [], saved: [], claimed: [], tracked: {} });
  const [progress, setProgress] = useState<StudentProgress>({ milestones: {}, applications: {} });
  const [profileUpdateMessage, setProfileUpdateMessage] = useState("");
  const opened = useRef(false);

  useEffect(() => {
    const message = localStorage.getItem(advisorProfileUpdatedMessageKey);
    if (!message) return;
    setProfileUpdateMessage(message);
    localStorage.removeItem(advisorProfileUpdatedMessageKey);
  }, []);
  useEffect(() => {
    const update = () => setActivity(readStudentActivity());
    update();
    window.addEventListener(studentActivityEvent, update);
    return () => window.removeEventListener(studentActivityEvent, update);
  }, []);
  useEffect(() => {
    const update = () => setProgress(readStudentProgress());
    update();
    window.addEventListener(studentProgressEvent, update);
    return () => window.removeEventListener(studentProgressEvent, update);
  }, []);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    trackProductEvent("journey_opened");
  }, []);

  const school = schools.find((item) => item.slug === profile.schoolSlug);
  if (!school) return null;
  const firstName = displayName(profile, session);
  const inferredProgress = inferApplicationsFromActivity(activity, opportunities, progress);
  const recommendationService = buildRecommendationService({ profile, school, activity, progress: inferredProgress, source: opportunities });
  const recommendations = recommendationService.recommendations.slice(0, 2);
  const milestones = buildJourneyMilestones({ profile, activity, progress: inferredProgress, opportunities });
  const recap = buildJourneyRecap({ activity, milestones, opportunities });
  const activeOpportunities = useMemo(() => Object.values(activity.tracked ?? {}).filter((record) => activeStatusSet.has(record.status)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((record) => {
    const opportunity = opportunities.find((item) => item.id === record.id);
    return opportunity ? { record, opportunity } : null;
  }).filter((item): item is ActiveOpportunity => Boolean(item)).slice(0, 4), [activity.tracked]);
  const timeline = [...milestones.slice().sort((a, b) => a.date.localeCompare(b.date)), ...futureMilestones(recap)].slice(0, 6);

  return <main className="bg-[radial-gradient(circle_at_top_left,rgba(231,216,189,.45),transparent_34rem),#f6f0e6] px-5 py-10 sm:px-8 sm:py-14">
    <div className="mx-auto max-w-[112rem] space-y-8">
      <JourneyHero firstName={firstName} fullName={displayFullName(profile, session)} profile={profile} school={school} tags={profileTags(profile)} syncError={syncError} profileUpdateMessage={profileUpdateMessage} />
      <SummaryGrid recap={recap} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,.88fr)_minmax(0,1.12fr)]">
        <JourneyTimeline items={timeline} />
        <div className="space-y-6">
          <ActiveOpportunities items={activeOpportunities} />
          <NextToReview recommendations={recommendations} />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,.88fr)_minmax(0,1.12fr)]">
        <MilestoneProgress milestones={milestones} recap={recap} />
        <JourneyRecapCard firstName={firstName} schoolName={school.name} recap={recap} />
      </div>
      <ClosingNote />
    </div>
  </main>;
}

function JourneyHero({ firstName, fullName, profile, school, tags, syncError, profileUpdateMessage }: { firstName: string; fullName: string; profile: StudentProfile; school: School; tags: string[]; syncError: string; profileUpdateMessage: string }) {
  const initials = `${profile.firstName?.[0] ?? firstName[0] ?? "U"}${profile.lastName?.[0] ?? ""}`.toUpperCase();
  const summary = [school.name, profile.major, profile.graduationYear ? `Class of ${profile.graduationYear}` : profile.year].filter(Boolean).join(" · ");
  return <section className="rounded-[2rem] bg-white/48 p-6 shadow-[0_18px_60px_rgba(43,33,26,.045)] ring-1 ring-ink/6 sm:p-8 lg:p-10">
    <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="grid h-24 w-24 shrink-0 place-items-center rounded-full bg-forest font-editorial text-4xl font-bold text-white shadow-[0_18px_45px_rgba(31,95,67,.22)]">{initials}</div>
        <div>
          <p className="rule-label text-forest">Journey</p>
          <h1 className="mt-3 font-editorial text-4xl font-bold leading-[1.02] tracking-[-.045em] text-ink sm:text-6xl">{fullName}&apos;s college journey</h1>
          {summary && <p className="mt-3 text-sm leading-7 text-ink/58">{summary}</p>}
          {tags.length ? <div className="mt-5 flex flex-wrap gap-4">{tags.map((tag) => <span key={tag} className="inline-flex items-center gap-2 text-sm font-bold text-ink/70"><span className="h-1.5 w-1.5 rounded-full bg-forest" />{tag}</span>)}</div> : null}
        </div>
      </div>
      <Link href="/profile" onClick={() => trackProductEvent("journey_profile_edit_clicked")} className="inline-flex min-h-12 items-center justify-center rounded-full border border-ink/10 bg-white px-5 text-sm font-bold text-ink/60 hover:border-forest hover:text-forest">Edit profile</Link>
    </div>
    {syncError && <p className="mt-5 text-sm font-bold text-red-700">{syncError}</p>}
    {profileUpdateMessage && <p role="status" className="mt-5 inline-flex rounded-full bg-white px-4 py-2 text-xs font-bold text-forest">{profileUpdateMessage}</p>}
  </section>;
}

function SummaryGrid({ recap }: { recap: JourneyRecap }) {
  const cards = [
    { label: "Saved", value: recap.opportunitiesSaved, text: "Keep exploring", Icon: BookmarkIcon, href: "/my-opportunities" },
    { label: "Applied", value: recap.applicationsSubmitted, text: "Take the next step", Icon: SendIcon, href: "/my-opportunities" },
    { label: "Interviews", value: recap.interviewsReached, text: "You’ve got this", Icon: TargetIcon, href: "/my-opportunities" },
    { label: "Completed", value: recap.completedOpportunities, text: "Milestones ahead", Icon: TrophyIcon, href: "/my-opportunities" },
  ];
  return <section aria-label="Journey progress" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {cards.map(({ label, value, text, Icon, href }) => <Link key={label} href={href} onClick={() => trackProductEvent("journey_summary_card_clicked", { filterName: "status", filterValue: label })} className="group flex min-h-36 items-center gap-5 rounded-[1.25rem] bg-white/88 p-6 shadow-[0_14px_42px_rgba(43,33,26,.06)] ring-1 ring-ink/7 hover:-translate-y-0.5 hover:shadow-[0_20px_52px_rgba(43,33,26,.1)] motion-reduce:hover:translate-y-0">
      <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-forest/10 text-forest"><Icon className="h-7 w-7" /></span>
      <span className="min-w-0"><span className="block text-sm font-black text-ink">{label}</span><span className="mt-1 block font-editorial text-4xl font-bold leading-none text-forest">{value}</span><span className="mt-2 block text-sm text-ink/50">{text}</span></span>
      <ArrowIcon className="ml-auto h-4 w-4 shrink-0 text-ink/35 group-hover:text-forest" />
    </Link>)}
  </section>;
}

function JourneyTimeline({ items }: { items: TimelineItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, 5);
  return <section className="rounded-[1.5rem] bg-white/86 p-6 shadow-[0_14px_42px_rgba(43,33,26,.055)] ring-1 ring-ink/7">
    <h2 className="font-editorial text-2xl font-bold">Journey timeline</h2>
    {visible.length ? <ol className="mt-6 space-y-7" aria-label="Meaningful journey events">{visible.map((item) => <TimelineRow key={item.id} item={item} />)}</ol> : <EmptyState title="Your timeline starts here" text="Save or track an opportunity and your real progress will appear here." actionHref="/opportunities" actionLabel="Open Discover" />}
    {items.length > 5 && <button type="button" onClick={() => setExpanded((value) => !value)} className="mt-8 flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-ink/12 bg-white text-sm font-bold text-ink/70 hover:border-forest hover:text-forest">{expanded ? "Show less" : "View full timeline"} <ArrowIcon className="h-3.5 w-3.5" /></button>}
  </section>;
}

function TimelineRow({ item }: { item: TimelineItem }) {
  const future = "future" in item;
  const Icon = categoryIcons[item.category];
  const content = <div className="grid grid-cols-[52px_minmax(0,1fr)_auto] gap-4">
    <div className="text-center text-xs font-black uppercase tracking-wider text-forest">{future ? "—" : compactDate(item.date)}</div>
    <div><p className="font-editorial text-lg font-bold leading-tight">{item.title}</p><p className="mt-1 text-sm leading-6 text-ink/52">{item.description}</p></div>
    <span className={`grid h-8 w-8 place-items-center rounded-full ${future ? "bg-white text-ink/35 ring-1 ring-ink/12" : "bg-forest text-white"}`}><Icon className="h-4 w-4" /></span>
  </div>;
  const href = !future && item.opportunityId ? `/opportunities/${item.opportunityId}` : future ? item.href : undefined;
  return <li className="relative border-l border-ink/12 pl-4">{href ? <Link href={href} onClick={() => trackProductEvent("journey_timeline_item_opened", { milestoneId: item.id })} className="block rounded-2xl p-2 hover:bg-paper/70">{content}</Link> : <div className="rounded-2xl p-2">{content}</div>}</li>;
}

function ActiveOpportunities({ items }: { items: ActiveOpportunity[] }) {
  return <section className="rounded-[1.5rem] bg-white/86 p-5 shadow-[0_14px_42px_rgba(43,33,26,.055)] ring-1 ring-ink/7">
    <div className="flex items-center justify-between gap-4"><h2 className="font-editorial text-2xl font-bold">Active opportunities</h2><Link href="/my-opportunities" className="text-sm font-black text-forest hover:text-ink">Open board</Link></div>
    {items.length ? <div className="mt-4 space-y-2">{items.map((item) => <ActiveOpportunityRow key={item.opportunity.id} opportunity={item.opportunity} status={item.record.status} />)}</div> : <EmptyState title="Nothing active yet" text="Save an opportunity from Discover to begin your Journey." actionHref="/opportunities" actionLabel="Open Discover" />}
  </section>;
}

function ActiveOpportunityRow({ opportunity, status }: { opportunity: Opportunity; status: OpportunityTrackerStatus }) {
  return <Link href={`/opportunities/${opportunity.id}`} onClick={() => trackProductEvent("journey_active_opportunity_opened", { opportunityId: opportunity.id, status })} className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border border-ink/7 bg-white/62 px-4 py-4 hover:border-forest/25">
    <span className="flex min-w-0 items-center gap-3"><OrganizationLogo opportunity={opportunity} size="sm"/><span className="min-w-0"><span className="rule-label text-forest">{opportunity.type}</span><span className="mt-1 block font-editorial text-lg font-bold leading-tight group-hover:text-forest">{opportunity.title}</span><span className="mt-1 block text-xs text-ink/45">{opportunity.organization} · {deadlineLabel(opportunity)}</span></span></span>
    <span className="flex items-center gap-3"><span className="rounded-full bg-forest/10 px-3 py-1 text-xs font-black text-forest">{statusCopy[status]}</span><ArrowIcon className="h-4 w-4 text-ink/30 group-hover:text-forest" /></span>
  </Link>;
}

function NextToReview({ recommendations }: { recommendations: RecommendationViewModel[] }) {
  return <section className="rounded-[1.5rem] bg-white/86 p-5 shadow-[0_14px_42px_rgba(43,33,26,.055)] ring-1 ring-ink/7">
    <div className="flex items-center justify-between gap-4"><h2 className="font-editorial text-2xl font-bold">Next to review</h2><Link href="/advisor" className="text-sm font-black text-forest hover:text-ink">Open For You</Link></div>
    {recommendations.length ? <div className="mt-4 divide-y divide-ink/10">{recommendations.map((recommendation) => <AdvisorRecommendationRow key={recommendation.recommendation.id} recommendation={recommendation} />)}</div> : <EmptyState title="No recommendation ready yet" text="As you save and review opportunities, UnlockED will surface the next best matches here." actionHref="/opportunities" actionLabel="Browse Discover" />}
  </section>;
}

function AdvisorRecommendationRow({ recommendation: view }: { recommendation: RecommendationViewModel }) {
  const { recommendation } = view;
  const opportunity = view.opportunity;
  return <article className="py-5">
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="flex gap-3">
        {opportunity && <OrganizationLogo opportunity={opportunity} size="sm"/>}
        <div className="min-w-0">
        <p className="rule-label text-forest">{recommendation.priority} · {recommendation.kind}</p>
        <h3 className="mt-2 font-editorial text-xl font-bold leading-tight">{recommendation.title}</h3>
        <p className="mt-2 text-sm leading-6 text-ink/55">{recommendation.reason}</p>
        <details className="mt-3" onToggle={(event) => { if ((event.currentTarget as HTMLDetailsElement).open) trackProductEvent("journey_recommendation_reason_expanded", { recommendationId: recommendation.id }); }}>
          <summary className="cursor-pointer text-xs font-black text-forest">Why this is a great match</summary>
          <ul className="mt-3 space-y-1 text-xs leading-5 text-ink/55">{view.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
        </details>
        </div>
      </div>
      <div className="flex items-center gap-3 sm:flex-col sm:items-end"><span className="text-sm font-black text-forest">{view.label}</span><Link href={view.href} onClick={() => trackProductEvent("journey_recommendation_opened", { recommendationId: recommendation.id, opportunityId: recommendation.relatedOpportunityId })} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-forest px-5 text-sm font-bold text-white hover:bg-ink">Open <ArrowIcon /></Link></div>
    </div>
  </article>;
}

function MilestoneProgress({ milestones, recap }: { milestones: JourneyMilestone[]; recap: JourneyRecap }) {
  const completedIds = new Set(milestones.map((item) => item.id));
  const steps = [
    { id: "first-saved", title: "First saved", description: "Save your first opportunity", Icon: BookmarkIcon },
    { id: "first-application", title: "First applied", description: "Start your first application", Icon: SendIcon },
    { id: "first-interview", title: "First interview", description: "Reach the interview stage", Icon: TargetIcon },
    { id: "first-completed", title: "First completed", description: "Complete an opportunity", Icon: TrophyIcon },
  ];
  const completedCount = steps.filter((step) => completedIds.has(step.id)).length;
  return <section className="rounded-[1.5rem] bg-white/86 p-6 shadow-[0_14px_42px_rgba(43,33,26,.055)] ring-1 ring-ink/7">
    <h2 className="font-editorial text-2xl font-bold">Milestones</h2>
    <div className="mt-7 grid gap-5 sm:grid-cols-4">{steps.map((step, index) => {
      const done = completedIds.has(step.id);
      const current = !done && index === completedCount;
      return <div key={step.id} className="text-center"><span className={`mx-auto grid h-14 w-14 place-items-center rounded-full ${done ? "bg-forest/10 text-forest" : current ? "bg-gold/20 text-ink" : "bg-paper text-ink/35"}`}><step.Icon className="h-6 w-6" /></span><p className="mt-3 text-sm font-black">{step.title}</p><p className="mt-1 text-xs leading-5 text-ink/50">{done ? milestones.find((item) => item.id === step.id)?.description : step.description}</p></div>;
    })}</div>
    <div className="mt-7 h-2 overflow-hidden rounded-full bg-paper"><div className="h-full rounded-full bg-forest transition-all duration-300" style={{ width: `${Math.round((completedCount / steps.length) * 100)}%` }} /></div>
    <p className="mt-4 text-sm text-ink/50">{recap.biggestMilestone ? `Latest: ${recap.biggestMilestone.title}` : "Your first milestone appears after you save an opportunity."}</p>
  </section>;
}

function JourneyRecapCard({ firstName, schoolName, recap }: { firstName: string; schoolName: string; recap: JourneyRecap }) {
  const [status, setStatus] = useState("");
  const [preview, setPreview] = useState(false);
  const shareText = `${recapHeadline(firstName, recap)} Saved: ${recap.opportunitiesSaved}. Applied: ${recap.applicationsSubmitted}. Interviews: ${recap.interviewsReached}. Completed: ${recap.completedOpportunities}.`;
  useEffect(() => { trackProductEvent("recap_viewed"); }, []);
  async function share() {
    trackProductEvent("share_card_generated");
    trackProductEvent("journey_recap_share_started");
    if (navigator.share) {
      await navigator.share({ title: "UnlockED Journey", text: shareText }).then(() => trackProductEvent("share_initiated")).catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(shareText).catch(() => undefined);
    setStatus("Copied recap");
    trackProductEvent("share_initiated");
  }
  function downloadRecap() {
    const svg = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350"><rect width="1080" height="1350" fill="#073f2d"/><text x="90" y="160" fill="#f6f0e6" font-size="42" font-family="Georgia">UnlockED Journey</text><text x="90" y="330" fill="#f6f0e6" font-size="76" font-family="Georgia">${recapHeadline(firstName, recap).replaceAll("&", "and")}</text><text x="90" y="470" fill="#f6f0e6" font-size="34" font-family="Arial">${schoolName.replaceAll("&", "and")}</text><text x="90" y="700" fill="#f6f0e6" font-size="46" font-family="Arial">Saved ${recap.opportunitiesSaved}   Applied ${recap.applicationsSubmitted}</text><text x="90" y="790" fill="#f6f0e6" font-size="46" font-family="Arial">Interviews ${recap.interviewsReached}   Completed ${recap.completedOpportunities}</text><text x="90" y="1210" fill="#e7d8bd" font-size="32" font-family="Arial">No opportunity names included by default.</text></svg>`);
    const link = document.createElement("a");
    link.href = `data:image/svg+xml;charset=utf-8,${svg}`;
    link.download = "unlocked-journey-recap.svg";
    link.click();
    setStatus("Downloaded recap");
    trackProductEvent("journey_recap_downloaded");
  }
  return <section className="overflow-hidden rounded-[1.5rem] bg-forest p-6 text-white shadow-[0_18px_60px_rgba(7,63,45,.2)]">
    <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center">
      <div><p className="rule-label text-white/70">Journey recap</p><h2 className="mt-4 font-editorial text-4xl font-bold leading-[1.04] tracking-[-.04em]">{recapHeadline(firstName, recap)}</h2><p className="mt-4 max-w-md text-sm leading-6 text-white/75">Every real step today creates better opportunities tomorrow.</p><div className="mt-6 flex flex-wrap gap-3"><button type="button" onClick={() => setPreview(true)} className="min-h-11 rounded-full bg-white px-5 text-sm font-bold text-ink hover:bg-paper">Preview recap</button><button type="button" onClick={() => void share()} className="min-h-11 rounded-full bg-white/12 px-5 text-sm font-bold text-white ring-1 ring-white/20 hover:bg-white/18">Share recap</button></div>{status && <p className="mt-3 text-xs font-bold text-white/70">{status}</p>}</div>
      <div className="rounded-[1.25rem] bg-paper p-5 text-ink"><dl className="grid grid-cols-2 gap-5"><JourneyMiniStat label="Saved" value={recap.opportunitiesSaved} /><JourneyMiniStat label="Applied" value={recap.applicationsSubmitted} /><JourneyMiniStat label="Interviews" value={recap.interviewsReached} /><JourneyMiniStat label="Completed" value={recap.completedOpportunities} /></dl></div>
    </div>
    {preview && <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 px-5" role="dialog" aria-modal="true" aria-label="Journey recap preview"><div className="w-full max-w-sm rounded-[2rem] bg-paper p-6 text-ink shadow-[0_30px_90px_rgba(43,33,26,.28)]"><p className="rule-label text-forest">Share preview</p><h3 className="mt-4 font-editorial text-4xl font-bold leading-tight">{recapHeadline(firstName, recap)}</h3><p className="mt-3 text-sm text-ink/55">This recap uses counts only. It does not include opportunity names or private profile details.</p><dl className="mt-6 grid grid-cols-2 gap-4"><JourneyMiniStat label="Saved" value={recap.opportunitiesSaved} /><JourneyMiniStat label="Applied" value={recap.applicationsSubmitted} /><JourneyMiniStat label="Interviews" value={recap.interviewsReached} /><JourneyMiniStat label="Completed" value={recap.completedOpportunities} /></dl><div className="mt-6 grid gap-3"><button type="button" onClick={() => void share()} className="min-h-11 rounded-full bg-forest px-5 text-sm font-bold text-white">Share</button><button type="button" onClick={downloadRecap} className="min-h-11 rounded-full border border-ink/15 px-5 text-sm font-bold text-ink/70">Download image</button><button type="button" onClick={() => setPreview(false)} className="min-h-11 rounded-full text-sm font-bold text-ink/45">Close</button></div></div></div>}
  </section>;
}

function JourneyMiniStat({ label, value }: { label: string; value: number }) {
  return <div><dt className="text-[10px] font-black uppercase tracking-[.14em] text-ink/40">{label}</dt><dd className="mt-1 font-editorial text-3xl font-bold text-forest">{value}</dd></div>;
}

function ClosingNote() {
  return <section className="rounded-[1.5rem] bg-white/48 px-6 py-6 ring-1 ring-ink/6"><p className="font-editorial text-2xl font-bold text-ink/75">Small steps today lead to bigger opportunities tomorrow.</p><p className="mt-2 text-sm text-ink/48">Keep showing up for your future self.</p></section>;
}

function EmptyState({ title, text, actionHref, actionLabel }: { title: string; text: string; actionHref?: string; actionLabel?: string }) {
  return <div className="py-6"><p className="font-editorial text-2xl font-bold">{title}</p><p className="mt-2 max-w-md text-sm leading-6 text-ink/45">{text}</p>{actionHref && actionLabel && <Link href={actionHref} className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-5 text-sm font-bold text-white hover:bg-forest">{actionLabel}</Link>}</div>;
}
