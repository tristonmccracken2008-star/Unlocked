import styles from "./first-launch-walkthrough.module.css";

type PreviewStep = "discover" | "for-you" | "journey" | "ready";

const organizations = [
  { mark: "G", name: "Google STEP", detail: "Internship", tone: "blue" },
  { mark: "NS", name: "NSF Research", detail: "Research", tone: "green" },
  { mark: "GH", name: "GitHub Student Pack", detail: "Software", tone: "ink" },
] as const;

function ProductChrome({ active }: { active: Exclude<PreviewStep, "ready"> }) {
  return <div className={styles.previewChrome}>
    <div className={styles.previewBrand}><span>U</span><strong>Unlock<span>ED</span></strong></div>
    <div className={styles.previewNavigation}>
      {(["Discover", "For You", "Journey"] as const).map((label) => <span key={label} data-active={label.toLowerCase().replace(" ", "-") === active}>{label}</span>)}
    </div>
    <div className={styles.previewAccount}><i /><span>Profile</span><b>A</b></div>
  </div>;
}

function OpportunityMiniCard({ mark, name, detail, tone }: typeof organizations[number]) {
  return <div className={styles.previewOpportunityCard}>
    <div className={styles.previewOpportunityTop}>
      <span className={styles.previewOrganization} data-tone={tone}>{mark}</span>
      <span className={styles.previewBookmark}>⌑</span>
    </div>
    <span className={styles.previewCategory}>{detail}</span>
    <strong>{name}</strong>
    <p>{detail === "Internship" ? "Build experience with a student-focused program." : detail === "Research" ? "Explore mentored undergraduate research." : "Student access to professional tools."}</p>
    <div className={styles.previewFacts}><span>Verified</span><span>{detail === "Software" ? "Free" : "Open"}</span></div>
  </div>;
}

function DiscoverPreview() {
  return <div className={`${styles.productPreview} ${styles.discoverPreview}`} data-preview-kind="discover">
    <ProductChrome active="discover" />
    <div className={styles.discoverCanvas}>
      <div className={styles.previewIntro}><span>Discover opportunities</span><h2>Find what’s out there.</h2></div>
      <div className={styles.previewSearch} data-preview-focus="true"><span>⌕</span><p>Search scholarships, internships, research...</p><kbd>⌘ K</kbd></div>
      <div className={styles.previewChips}><b>All</b><span>Scholarships</span><span>Internships</span><span>Research</span><span>Software</span></div>
      <div className={styles.discoverResults}>
        <aside><strong>Filters</strong><span>Opportunity type</span><span>Eligibility</span><span>Deadline</span><span>Location</span></aside>
        <section><div className={styles.previewResultHeading}><div><small>Recommended results</small><strong>Opportunities for students</strong></div><span>Most relevant</span></div><div className={styles.previewCardGrid}>{organizations.map((item) => <OpportunityMiniCard key={item.name} {...item} />)}</div></section>
      </div>
    </div>
  </div>;
}

function ForYouPreview() {
  return <div className={`${styles.productPreview} ${styles.forYouPreview}`} data-preview-kind="for-you">
    <ProductChrome active="for-you" />
    <div className={styles.forYouCanvas}>
      <div className={styles.previewIntro}><span>For you</span><h2>Top picks for you.</h2><p>A short list based on your profile and Journey.</p></div>
      <div className={styles.previewProfileLine}><span>University of Chicago</span><span>Mathematics</span><span>First year</span><span>Research</span></div>
      <div className={styles.recommendationFeature} data-preview-focus="true">
        <div className={styles.recommendationMain}><span className={styles.previewCategory}>Top pick</span><div className={styles.recommendationIdentity}><span className={styles.previewOrganization} data-tone="green">NS</span><div><small>National Science Foundation</small><strong>Undergraduate Research Program</strong></div></div><p>A mentored research experience for undergraduates.</p><div className={styles.matchSignals}><span>Matches your major</span><span>First-year friendly</span><span>Official source</span></div></div>
        <aside><small>Deadline</small><strong>Applications open</strong><hr /><small>Source</small><b>Official</b><span className={styles.previewAction}>Open opportunity</span></aside>
      </div>
      <div className={styles.previewRecommendationRows}><span>02</span><strong>COMAP Mathematical Contest</strong><i>New for you</i><span>03</span><strong>Career Ready Certificate</strong><i>Deadline soon</i></div>
    </div>
  </div>;
}

function JourneyPreview() {
  const records = [
    ["G", "Google STEP Internship", "Preparing", "Deadline in 4 days"],
    ["JS", "Jane Street Summer Analyst", "Interviewing", "Interview tomorrow"],
    ["GS", "Goldman Sachs Summer Analyst", "Applied", "Updated 3 days ago"],
  ] as const;
  return <div className={`${styles.productPreview} ${styles.journeyPreview}`} data-preview-kind="journey">
    <ProductChrome active="journey" />
    <div className={styles.journeyCanvas}>
      <div className={styles.journeyHeading}><div className={styles.previewIntro}><span>Journey</span><h2>Your opportunities, organized.</h2><p>A private record of what you saved, pursued, and accomplished.</p></div><span className={styles.previewAction}>Add opportunity</span></div>
      <div className={styles.journeySummary}>
        <div data-accent="green"><small>Next deadline</small><strong>4 days</strong><span>Google STEP Internship</span></div>
        <div data-accent="gold"><small>Waiting on</small><strong>1 interview</strong><span>Tomorrow at 10:00 AM</span></div>
        <div data-accent="violet"><small>Newest milestone</small><strong>First application</strong><span>Recorded this week</span></div>
      </div>
      <section className={styles.journeyActions} data-preview-focus="true"><header><strong>Things to do</strong><span>3</span></header><div><b>□</b><p><strong>Google STEP deadline in 4 days</strong><span>Apply by August 22</span></p><i>High priority</i></div><div><b>○</b><p><strong>Interview reminder: Jane Street</strong><span>Tomorrow at 10:00 AM</span></p><i>Due tomorrow</i></div></section>
      <section className={styles.journeyRecords}><header><strong>Active opportunities</strong><div><span>All</span><span>Preparing</span><span>Applied</span><span>Interviewing</span></div></header>{records.map(([mark, name, status, detail]) => <div key={name}><span className={styles.previewOrganization} data-tone={mark === "G" ? "blue" : "ink"}>{mark}</span><p><strong>{name}</strong><span>{detail}</span></p><i data-status={status.toLowerCase()}>{status}</i><span className={styles.previewUpdate}>Update</span></div>)}</section>
    </div>
  </div>;
}

export function FirstLaunchPreview({ step }: { step: PreviewStep }) {
  if (step === "for-you") return <ForYouPreview />;
  if (step === "journey") return <JourneyPreview />;
  return <DiscoverPreview />;
}
