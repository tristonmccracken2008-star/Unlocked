import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { deadlineLabel, getRelatedOpportunities, type Opportunity } from "@/data/opportunities";
import { schools } from "@/data/seed";
import { ConfidenceBadge, StatusBadge } from "@/components/status-badge";
import { OpportunityActivityActions, OpportunityViewTracker } from "@/components/opportunity-activity";
import { OrganizationLogo } from "@/components/organization-logo";
import { ArrowIcon } from "@/components/icons";
import { ReportOutdatedButton } from "@/components/report-outdated-button";
import { maintenanceStatus } from "@/data/opportunity-maintenance";
import { getManagedOpportunity, listPublishedOpportunities } from "@/lib/content-store";
import { createAdvisorProfile } from "@/data/advisor-engine";
import { explainOpportunityWithAdvisorBrain, type OpportunityAdvisorExplanation } from "@/data/advisor-brain";
import { inferApplicationsFromActivity, normalizeStudentProgress } from "@/data/student-progress";
import { getSession, sessionCookieName } from "@/lib/auth-store";
import type { StudentActivity } from "@/data/student-activity";

export const dynamic="force-dynamic";
export async function generateMetadata({params}:{params:Promise<{id:string}>}):Promise<Metadata>{const item=await getManagedOpportunity((await params).id);if(!item)return{title:"Opportunity not found"};const title=`${item.title}: Eligibility, Value & How to Apply`;const description=`A verified guide to ${item.title} from ${item.organization}, including eligibility, value, timeline, official source, and application guidance.`;return{title,description,alternates:{canonical:`/opportunities/${item.id}`},openGraph:{title,description,url:`/opportunities/${item.id}`,type:"article"}}}

const unknown = (label:string) => `Unknown — the official source reviewed by UnlockED does not specify ${label}.`;
const formatMoney = (value:number) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(value);

function applicationSteps(item:Opportunity){
  if(item.metadata.claimSteps?.length)return item.metadata.claimSteps;
  const materials=item.metadata.applicationRequirements?.length?`Prepare the listed materials: ${item.metadata.applicationRequirements.join(", ")}.`:"Check the official listing for required materials; the source reviewed by UnlockED does not publish a complete checklist.";
  return [`Review the official ${item.organization} listing and confirm that its current eligibility rules match your situation.`,materials,`Complete the provider’s application process on its official site. UnlockED has not verified a more detailed submission sequence.`];
}

function valueLabel(item:Opportunity){if(item.estimated_value)return `${formatMoney(item.estimated_value)}+`;if(item.type==="Scholarship")return item.metadata.awardAmountLabel??"Amount not documented";if(item.type==="Benefit")return item.metadata.valueLabel??"Value not documented";return "No verified dollar value"}
function renewal(item:Opportunity){if(item.metadata.renewalNotes)return item.metadata.renewalNotes;if(item.type==="Scholarship"&&item.metadata.renewable!==undefined)return item.metadata.renewable===null?"Renewal varies by award; confirm on the official source.":item.metadata.renewable?"The catalog marks this award renewable; confirm current renewal requirements on the official source.":"The catalog marks this as a one-time award.";if(item.recurring)return"The opportunity is marked recurring, but its recurrence schedule is not documented.";return unknown("renewal or recurrence terms")}
function whyThisMatters(item:Opportunity){
  const audience=bestFor(item);
  if(item.type==="Scholarship")return [`This award may reduce education costs for ${audience}. Receiving it is not guaranteed, and the practical impact depends on the final award and renewal terms.`, `The application can also clarify which academic work, service, or experience the sponsor values; use the official criteria as the standard.`];
  if(item.type==="Career")return [`This ${item.category.toLowerCase()} opportunity gives ${audience} a documented route to explore work at ${item.organization}. Actual skill development, networking, and career impact depend on the role, selection process, and work assigned.`, `It is most useful when the responsibilities align with skills you are actively trying to build.`];
  if(item.type==="Research")return [`This opportunity can give ${audience} exposure to research methods, technical communication, and mentor-guided work through ${item.organization}. Projects and outcomes vary, so confirm the current department and placement details before applying.`];
  if(item.type==="AI")return [`This tool may help ${audience} with ${item.category.toLowerCase()} workflows. Its value depends on the current access tier, course rules, and how often the student uses it; no learning outcome is guaranteed.`];
  return [`This offer can give ${audience} access to ${item.description.charAt(0).toLowerCase()+item.description.slice(1)} Its practical value depends on continued eligibility, current provider terms, and actual use.`];
}
function bestFor(item:Opportunity){const majors=item.majors.includes("Any Major")?"students in any major":`${item.majors.slice(0,3).join(", ")} students`;const years=item.academic_years.includes("Any Year")?"at any academic level":`in ${item.academic_years.slice(0,3).join(", ").toLowerCase()}`;return`${majors} ${years}`}
function timeRequired(item:Opportunity){if(item.type==="Benefit"||item.type==="AI")return item.metadata.claimSteps?.length?`${item.metadata.claimSteps.length} account and verification steps; elapsed time is not published.`:"Not published by the provider.";if(item.metadata.applicationRequirements?.length)return`Varies; ${item.metadata.applicationRequirements.length} documented application requirement${item.metadata.applicationRequirements.length===1?"":"s"}.`;return"Not published by the official source reviewed."}
function goalPath(item:Opportunity):[string,string]{if(item.school_scope==="School Specific")return["My University","/university"];if(item.type==="Career"||item.type==="Research")return["Build Your Career","/build-career"];if(item.type==="Scholarship"||(item.type==="Benefit"&&["Finance","Shopping","Streaming","Travel"].includes(item.category)))return["Save Money","/save-money"];return["Get Ahead","/get-ahead"]}

async function personalizedExplanation(item: Opportunity, catalog: readonly Opportunity[]): Promise<OpportunityAdvisorExplanation | null> {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get(sessionCookieName)?.value);
  const profile = session?.data.profile;
  if (!profile || !session.data.onboardingComplete) return null;
  const school = schools.find((candidate) => candidate.slug === profile.schoolSlug);
  if (!school) return null;
  const activity: StudentActivity = session.data.activity ?? {
    viewed: [],
    saved: session.data.savedOpportunities.map((record) => record.opportunityId),
    claimed: [],
    tracked: session.data.tracker,
  };
  const progress = inferApplicationsFromActivity(activity, catalog, normalizeStudentProgress({
    milestones: Object.fromEntries(Object.entries(session.data.journeyProgress ?? {}).map(([milestoneId, completed]) => [milestoneId, {
      milestoneId,
      status: completed ? "completed" : "not_started",
      source: "inferred",
      updatedAt: session.data.updatedAt,
    }])),
  }));
  const advisorProfile = createAdvisorProfile({ profile, school, activity, progress });
  return explainOpportunityWithAdvisorBrain({ advisorProfile, opportunity: item, progress });
}

export default async function Page({params}:{params:Promise<{id:string}>}){
  const item=await getManagedOpportunity((await params).id);if(!item)notFound();
  const catalog=await listPublishedOpportunities();
  const displayedStatus=maintenanceStatus(item);
  const itemGoal=goalPath(item);
  const related=getRelatedOpportunities(item,5,catalog);
  const advisorExplanation=await personalizedExplanation(item,catalog);
  const schoolNames=item.schools.map((slug)=>schools.find((school)=>school.slug===slug)?.name??slug);
  const requirements=[item.eligibility,...(item.metadata.applicationRequirements??[]),...(item.metadata.eligibilityNotes??[])];
  const gpa=requirements.find((value)=>/\bgpa\b/i.test(value))??unknown("GPA requirements");
  const citizenship=requirements.find((value)=>/citizen|residen|nationality|international|country/i.test(value))??unknown("citizenship or residency requirements");
  const prerequisites=item.metadata.applicationRequirements?.length?item.metadata.applicationRequirements.join("; "):unknown("prerequisites");
  const faq=[
    {q:`Is ${item.title} currently verified?`,a:`UnlockED lists this opportunity as ${displayedStatus.replaceAll("_"," ")} and last reviewed it on ${item.last_verified}. Always confirm current terms on the official source.`},
    {q:`Who is ${item.title} for?`,a:item.eligibility},
    {q:`What is ${item.title} worth?`,a:item.estimated_value?`The catalog contains a documented or reasonably calculated value of ${formatMoney(item.estimated_value)}. Actual value depends on eligibility and use.`:"No verified dollar value is currently documented."},
    {q:`When is the deadline?`,a:item.application_deadline?`The documented deadline is ${deadlineLabel(item)}.`:unknown("the current deadline")},
    {q:"Where should I apply or claim it?",a:`Use the official ${item.organization} source linked on this page. UnlockED does not accept applications or determine eligibility.`},
  ];
  const jsonLd={"@context":"https://schema.org","@type":"Article",headline:item.title,description:item.description,dateModified:item.last_verified,author:{"@type":"Organization",name:"UnlockED"},publisher:{"@type":"Organization",name:"UnlockED"},mainEntityOfPage:`https://unlocked.education/opportunities/${item.id}`};
  const faqLd={"@context":"https://schema.org","@type":"FAQPage",mainEntity:faq.map(({q,a})=>({"@type":"Question",name:q,acceptedAnswer:{"@type":"Answer",text:a}}))};
  return <>
    <OpportunityViewTracker opportunityId={item.id}/>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(jsonLd)}}/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(faqLd)}}/>
    <header className="bg-white px-5 py-12 sm:px-8 sm:py-20"><div className="mx-auto max-w-6xl">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs font-bold text-ink/40"><Link href="/">Dashboard</Link><span>/</span><Link href="/opportunities" className="text-forest">Discover</Link><span>/</span><span>{item.type}</span></nav>
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start"><div className="min-w-0"><div className="flex flex-wrap items-center gap-3"><span className="rule-label text-forest">{item.type}</span><span className="rule-label text-ink/40">{item.category}</span><StatusBadge status={displayedStatus}/></div><div className="mt-6 flex items-center gap-4"><OrganizationLogo opportunity={item} size="lg"/><p className="text-sm font-bold uppercase tracking-widest text-ink/35">{item.organization}</p></div><h1 className="mt-4 max-w-4xl font-editorial text-5xl font-bold leading-[1] tracking-[-.05em] sm:text-7xl">{item.title}</h1><p className="mt-7 max-w-3xl text-lg leading-8 text-ink/60">{item.description}</p></div><aside className="rounded-[2rem] bg-paper p-5 shadow-soft"><p className="rule-label text-forest">Official next step</p><OpportunityActivityActions opportunityId={item.id} type={item.type} officialSource={item.official_source}/><div className="mt-5 border-t border-ink/10 pt-5"><p className="rule-label text-ink/35">Last verified</p><p className="mt-2 font-bold">{item.last_verified}</p></div></aside></div>
      <section aria-labelledby="quick-facts" className="mt-12"><h2 id="quick-facts" className="rule-label text-forest">Quick facts</h2><dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Detail label="Estimated value" value={valueLabel(item)}/><Detail label="Time required" value={timeRequired(item)}/><Detail label="Difficulty" value={item.difficulty??"Not published by the official source reviewed."}/><Detail label="Best for" value={bestFor(item)}/></dl></section>
    </div></header>

    <main className="px-5 py-12 sm:px-8 sm:py-16"><div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,1fr)_280px]"><article className="space-y-14">
      <GuideSection eyebrow="Overview" title={`What ${item.title} offers`}><p className="max-w-3xl text-base leading-7 text-ink/65">{item.description} It is listed as a {item.school_scope.toLowerCase()} {item.type.toLowerCase()} opportunity and is administered by {item.organization}, not UnlockED.</p></GuideSection>

      <section aria-labelledby="why-this-matters" className="rounded-[2rem] bg-paper px-5 py-6 sm:px-7"><p className="rule-label text-forest">Student impact</p><h2 id="why-this-matters" className="mt-2 font-editorial text-3xl font-bold tracking-[-.025em]">Why this matters</h2><div className="mt-4 space-y-2">{whyThisMatters(item).map((sentence)=><p key={sentence} className="text-sm leading-6 text-ink/65">{sentence}</p>)}</div></section>

      {advisorExplanation && <OpportunityAdvisorBrainSection explanation={advisorExplanation} />}

      <GuideSection eyebrow="Eligibility" title="Who can apply or claim"><p className="leading-7 text-ink/65">{item.eligibility}</p><dl className="mt-6 grid gap-3 sm:grid-cols-2"><Detail label="Eligible schools" value={item.school_scope==="National"?"National opportunity; no school list restriction is recorded. Provider restrictions may still apply.":schoolNames.join(", ")||unknown("eligible schools")}/><Detail label="Eligible majors" value={item.majors.join(", ")}/><Detail label="Academic years" value={item.academic_years.join(", ")}/><Detail label="GPA requirements" value={gpa}/><Detail label="Citizenship / location" value={citizenship}/><Detail label="Prerequisites" value={prerequisites}/></dl></GuideSection>

      <GuideSection eyebrow="How to claim or apply" title="A clear path to the official process"><ol className="mt-2 divide-y divide-ink/10 rounded-[1.5rem] bg-white">{applicationSteps(item).map((step,index)=><li key={`${index}-${step}`} className="grid grid-cols-[36px_1fr] gap-4 p-4 sm:p-5"><span className="font-mono text-xs font-bold text-forest">{String(index+1).padStart(2,"0")}</span><p className="text-sm leading-6 text-ink/65">{step}</p></li>)}</ol><p className="mt-4 text-xs leading-5 text-ink/40">Application processes can change. The official provider page controls current requirements and submission steps.</p></GuideSection>

      <GuideSection eyebrow="Value and effort" title="What is documented—and what is not"><dl className="grid gap-3 sm:grid-cols-2"><Detail label="Documented dollar value" value={valueLabel(item)}/><Detail label="Time required" value={timeRequired(item)}/><Detail label="Career relevance" value={item.prestige?`${item.prestige} editorial context based on the catalog record; this is not a provider guarantee.`:"No verified career-impact estimate is available."}/><Detail label="Selectivity or difficulty" value={item.difficulty??"Not published by the official source reviewed."}/></dl></GuideSection>

      <GuideSection eyebrow="Timeline" title="Dates and renewal information"><dl className="grid gap-3 sm:grid-cols-2"><Detail label="Opens" value={unknown("the opening date")}/><Detail label="Deadline" value={item.application_deadline?deadlineLabel(item):deadlineLabel(item)}/><Detail label="Decision timeline" value={unknown("the decision or approval timeline")}/><Detail label="Renewal / recurrence" value={renewal(item)}/></dl></GuideSection>

      <GuideSection eyebrow="Frequently asked questions" title={`Questions students ask about ${item.title}`}><div className="divide-y divide-ink/10 rounded-[1.5rem] bg-white">{faq.map(({q,a})=><details key={q} className="p-5"><summary className="cursor-pointer font-bold">{q}</summary><p className="mt-3 text-sm leading-6 text-ink/60">{a}</p></details>)}</div></GuideSection>

      <GuideSection eyebrow="Similar opportunities" title="Continue exploring verified options"><div className="grid gap-3 sm:grid-cols-2">{related.map((candidate)=><Link key={candidate.id} href={`/opportunities/${candidate.id}`} className="group rounded-[1.5rem] bg-white p-5 ring-1 ring-ink/8"><div className="flex flex-wrap items-center gap-2"><span className="rule-label text-forest">{candidate.type}</span><StatusBadge status={candidate.verification_status}/><ConfidenceBadge status={candidate.verification_status}/></div><div className="mt-4 flex items-start gap-3"><OrganizationLogo opportunity={candidate} size="sm"/><div className="min-w-0"><h3 className="font-editorial text-xl font-bold group-hover:text-forest">{candidate.title}</h3><p className="mt-2 text-xs font-bold uppercase tracking-wider text-ink/35">{candidate.organization}</p></div></div><p className="mt-3 line-clamp-2 text-sm leading-6 text-ink/50">{candidate.description}</p><span className="mt-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider">Read guide <ArrowIcon/></span></Link>)}</div></GuideSection>
    </article>

    <aside className="h-fit rounded-[2rem] bg-white p-5 shadow-soft ring-1 ring-ink/8 lg:sticky lg:top-6"><p className="rule-label text-forest">Trust & verification</p><div className="mt-3 flex flex-wrap items-center gap-2"><StatusBadge status={displayedStatus}/><ConfidenceBadge status={displayedStatus}/></div><dl className="mt-5 space-y-4 text-sm"><div><dt className="text-ink/40">Official provider</dt><dd className="mt-1 font-bold">{item.organization}</dd></div><div><dt className="text-ink/40">Last verified</dt><dd className="mt-1 font-bold">{item.last_verified}</dd></div><div><dt className="text-ink/40">Source</dt><dd className="mt-1 break-words text-xs text-ink/55">{item.official_source}</dd></div></dl><a href={item.official_source} target="_blank" rel="noreferrer" className="mt-6 flex min-h-11 items-center justify-center gap-2 rounded-full bg-ink px-4 text-sm font-bold text-white hover:bg-forest">Official source <ArrowIcon/></a><ReportOutdatedButton opportunityId={item.id}/><section className="mt-6 border-t border-ink/10 pt-5"><h2 className="font-editorial text-xl font-bold">Why trust this?</h2><p className="mt-3 text-xs leading-5 text-ink/50">UnlockED verifies listings against official provider or university sources and regularly reviews published details. Missing information is shown as unknown rather than inferred.</p><p className="mt-3 text-[11px] leading-5 text-ink/40">UnlockED does not administer this opportunity or determine eligibility.</p></section></aside>
    </div></main>
  </>
}

function GuideSection({eyebrow,title,children}:{eyebrow:string;title:string;children:ReactNode}){return <section><p className="rule-label text-forest">{eyebrow}</p><h2 className="mt-2 font-editorial text-3xl font-bold tracking-[-.025em]">{title}</h2><div className="mt-5">{children}</div></section>}
function Detail({label,value}:{label:string;value:string}){return <div className="rounded-2xl bg-white p-4 ring-1 ring-ink/8"><dt className="rule-label text-ink/35">{label}</dt><dd className="mt-2 text-sm leading-6 text-ink/65">{value}</dd></div>}

function OpportunityAdvisorBrainSection({ explanation }: { explanation: OpportunityAdvisorExplanation }) {
  return <section aria-labelledby="advisor-fit" className="rounded-[2rem] bg-white px-5 py-6 ring-1 ring-ink/8 sm:px-7">
    <p className="rule-label text-forest">Advisor Brain</p>
    <h2 id="advisor-fit" className="mt-2 font-editorial text-3xl font-bold tracking-[-.025em]">Why this is recommended for you</h2>
    <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div>
        <ul className="space-y-2 text-sm leading-6 text-ink/65">{explanation.whyRecommended.map((reason)=><li key={reason}>{reason}</li>)}</ul>
        <details className="mt-5 border-t border-ink/10 pt-4">
          <summary className="cursor-pointer text-sm font-bold text-forest">Evidence, impact, and tradeoffs</summary>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <Detail label="Skills gained" value={explanation.skillsGained.join(", ")}/>
            <Detail label="Competencies strengthened" value={explanation.competenciesStrengthened.join(", ")}/>
            <Detail label="Evidence generated" value={explanation.evidenceGenerated.join(" ")}/>
            <Detail label="Resume impact" value={explanation.resumeImpact}/>
            <Detail label="Interview value" value={explanation.interviewValue}/>
            <Detail label="Estimated ROI" value={explanation.estimatedRoi}/>
          </dl>
          <div className="mt-4 grid gap-4 text-xs leading-5 text-ink/50 md:grid-cols-3">
            <ExplainList title="Evidence used" values={explanation.evidenceUsed}/>
            <ExplainList title="Expected impact" values={[explanation.expectedImpact]}/>
            <ExplainList title="Tradeoffs" values={explanation.tradeoffs}/>
          </div>
        </details>
      </div>
      <aside className="rounded-[1.5rem] bg-paper p-5">
        <p className="rule-label text-ink/35">Confidence</p>
        <p className="mt-2 font-editorial text-5xl font-bold tracking-[-.04em]">{explanation.confidence}%</p>
        <p className="mt-4 text-xs font-bold uppercase tracking-wider text-ink/35">Estimated time</p>
        <p className="mt-2 text-sm leading-6 text-ink/55">{explanation.estimatedCompletionTime}</p>
      </aside>
    </div>
  </section>;
}

function ExplainList({ title, values }: { title: string; values: string[] }) {
  return <div><p className="font-bold uppercase tracking-wider text-ink/35">{title}</p><ul className="mt-2 space-y-1">{values.map((value)=><li key={value}>{value}</li>)}</ul></div>;
}
