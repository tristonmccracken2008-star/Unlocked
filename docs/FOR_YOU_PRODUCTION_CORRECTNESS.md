# For You Production Correctness Report

Date: 2026-07-13

## Incident causes

### Ineligible records survived through stale snapshots

The current live evaluator already rejected Community College Internships for a four-year student. The leak occurred because `resolveForYouState()` returned any old snapshot as `stale` while a refresh ran, even when its engine, source, or profile version was incompatible. The source hash also omitted eligibility text, class years, structured eligibility rules, deadlines, and several verification fields. The profile hash omitted institution type, enrollment, degree level, citizenship, work authorization, residency, age, transfer status, financial need, merit, and eligibility attributes.

The secondary classification defect was a high-school pattern that matched `high school students` but not `high school seniors`.

### Valid profiles received empty feeds

Application availability was included in the hard personal-eligibility result. A verified internship, scholarship, or research program with `not_announced` or `varies` deadline metadata failed as though the student were personally ineligible. For the UChicago Math/CS regression profile, this removed 113 validated records before ranking. The Advisor Brain also mixed three milestone recommendations into an eight-item result before the product service removed non-opportunity items, reducing the usable feed further.

### Navigation appeared unresponsive

`/advisor` is a dynamic server route. It had no App Router `loading.tsx` boundary and the header did not show a pending state. A cold session-store read plus snapshot resolution therefore produced no visible response after a valid semantic-link click. Authentication and cookie creation were not the failure.

## Canonical eligibility

`data/opportunity-eligibility-model.ts` is the normalized source of truth for:

- education level;
- enrollment status;
- institution type;
- specific and host schools;
- external-student access;
- class year and major;
- GPA, citizenship, residency, and age;
- financial need, transfer, high-school-senior, and invitation requirements;
- recommendation eligibility status and supporting evidence.

Hard personal constraints are evaluated before scoring. Unknown critical constraints fail closed. Unknown effort, value, or competitiveness do not make a student ineligible. Known closed, expired, archived, or unverified records cannot fill a recommendation slot.

The recommendation eligibility states are:

- `eligible_for_ranking`: verified and safe for the professional pipeline;
- `discover_only`: useful catalog record, but not currently actionable for Pro ranking;
- `needs_eligibility_review`: one or more critical constraints are unresolved;
- `ineligible`: retired or unusable for recommendations.

## Recommendation tiers

- **Excellent**: fully eligible, verified, actionable, high confidence, and top structured score.
- **Strong**: fully eligible, verified, actionable, and professionally useful.
- **Explore**: fully eligible and verified, but less personalized or waiting for the next announced application cycle.

Explore changes personalization requirements only. It does not relax eligibility, source, verification, metadata, or final-audit requirements. Every Explore item still needs professional eligibility, metadata, and verification confidence of at least 78.

## Snapshot contract

Snapshots now store and validate:

- user ID;
- profile version;
- engine version;
- eligibility schema version;
- catalog version;
- recommendation-rules version;
- source-signals version;
- generated and expiration timestamps.

Only an expired but fully compatible snapshot may render during background refresh. Every compatible snapshot is also re-audited against the current profile and final professional gate before rendering. Incompatible, cross-user, edited-profile, or unsafe snapshots are treated as missing and regenerated.

## Corrected production records

- **DOE Community College Internships**: current community-college enrollment, associate level, 2.7 GPA, age 18, U.S.-person requirement, Spring 2027 deadline, and official evidence recorded.
- **Amazon Future Engineer Scholarship**: high-school-senior-only, 2.3 GPA, financial need, U.S. work authorization, and current closed cycle recorded.
- **Microsoft Disability Scholarship**: high-school-senior-only, 2.5 GPA, financial need, disability requirement, international eligibility, current official source, and closed cycle recorded.
- **Caltech SURF**: visiting non-Caltech undergraduate eligibility, 2.5 GPA, host school, external-student access, and closed 2026 cycle recorded.
- **Brooke Owens Fellowship**: broad accredited-undergraduate institution access, gender-minority requirement, completed-semester requirement, and closed 2026 cycle recorded.

Official evidence:

- `https://science.osti.gov/wdts/cci/Eligibility`
- `https://science.osti.gov/wdts/cci/How-to-Apply`
- `https://www.amazonfutureengineer.com/scholarships`
- `https://learnmore.scholarsapply.org/microsoft-disability/`
- `https://sfp.caltech.edu/undergraduate-research/programs/surf/eligibility_requirements`
- `https://www.brookeowensfellowship.org/apply`

## Catalog audit

Catalog size: 5,991.

- Eligible for ranking: 138
- Discover only: 4
- Needs eligibility review: 5,848
- Ineligible: 1
- Canonical community-college-only records: 53
- Canonical high-school-senior-only records: 7
- School-specific/campus-only records: 5,785
- Named school hosts still missing external-student proof: 11
- Variable critical eligibility requiring review: 4,428
- Unresolved citizenship rules: 62

The large review population is intentionally quarantined. These records remain searchable in Discover but cannot enter the paid recommendation feed.

## Coverage and performance

The 250-profile golden suite includes the required UChicago, Purdue, Caltech, community-college, high-school, international, no-GPA, undecided, research, remote, banking, publishing, and pre-med cases.

- College profiles ranked: 249
- Empty undergraduate feeds: 0
- Average recommendations: 8.0
- Total recommendations checked: 1,991
- Excellent: 1,054
- Strong: 380
- Explore: 557
- Eligibility bypasses: 0

Representative UChicago funnel:

`138 rankable -> 134 education -> 117 school -> 89 year/major -> 86 GPA/need -> 85 citizenship/other hard constraints -> 85 confidence -> 8 selected`

The production engine uses a precomputed catalog data-validation index and cached canonical eligibility records. User-specific scoring stays server-side and bounded. No official-source request occurs during recommendation generation.

### Before and after

- Before: the traced UChicago Math/CS profile had only five usable opportunity recommendations after hard application-cycle filtering and milestone removal; other ordinary undergraduate combinations could reach zero.
- After: the same regression profile receives eight eligible opportunities: three Excellent, three Strong, and two Explore.
- After: 249 of 249 undergraduate golden profiles receive recommendations, averaging 8.0 per profile.
- The exhaustive 512-profile adversarial audit returned 2,774 recommendations. Its 136 empty profiles are concentrated in graduate, unknown-institution, and intentionally incompatible combinations outside the undergraduate launch guarantee. The slowest individual ranking was 518 ms.

When a paid profile genuinely produces no result, the server now logs aggregate funnel counts, the last stage with viable candidates, whether Explore fallback ran, and top rejection categories. It does not log profile answers, identity data, or recommendation contents. The measured empty-profile diagnostic pass took 237 ms locally.

## Navigation verification

Desktop and mobile use semantic links. For You disables expensive hover prefetch, shows visible and accessible pending feedback immediately, and has a server-first loading boundary for cold functions and slow session stores. OAuth still writes the session cookie before redirecting, and the edge proxy validates the signed cookie without waiting for the remote account store.

## Remaining work

The undergraduate paid feed is ready for deployment based on deterministic coverage and safety checks. Graduate/recent-graduate completeness remains a product-scope limitation, not an eligibility defect. Continue reviewing the 5,848 quarantined records, prioritizing the 11 named-school external-access gaps and 62 unresolved citizenship rules. After deployment, complete the requested real-account, three-profile, Free-account, and private-window smoke tests.
