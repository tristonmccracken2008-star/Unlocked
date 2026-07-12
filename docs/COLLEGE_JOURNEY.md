# College Journey

College Journey is the shareable layer on top of the existing Journey Board. The board remains the daily workspace for moving opportunities through statuses. College Journey summarizes real progress from the same persisted activity records.

## Data Flow

The canonical service is `data/journey.ts`.

It powers:

- Journey Board-compatible status counts
- College Journey progress
- milestone completion
- timeline-ready milestone records
- activity heatmap points
- Journey Card recap values
- time-range filtering

The service reads `StudentActivity.tracked` records and the existing `Opportunity` catalog. It does not create a second tracking system.

## Milestone Catalog

The fixed catalog is `journeyMilestoneCatalog`.

Current milestones:

- Completed profile
- Added first opportunity to Journey
- Saved first opportunity
- Saved five opportunities
- Saved ten opportunities
- Started first application
- Submitted first application
- Submitted five applications
- Reached first interview
- Reached three interviews
- Received first acceptance
- Completed first opportunity
- Pursued first research opportunity
- Pursued first scholarship
- Pursued first internship
- Claimed first student benefit
- Used first AI or software benefit

Each milestone has:

- stable `id`
- title
- description
- category
- deterministic completion rule
- order
- `shareable` flag

## Progress Rule

Progress is deterministic:

```text
completed milestones / applicable milestones
```

Version 1 uses the full fixed catalog as the applicable denominator. This keeps the denominator stable and explainable. A future version may add eligibility-aware denominators, but only if the rule is explicit and does not mislead students.

## Real Data Only

College Journey may use:

- profile completion timestamp
- opportunity saved timestamp
- Journey status timestamps
- opportunity category/type
- profile interests
- school, major, and class year if the user leaves those privacy toggles enabled

College Journey must not fabricate:

- saved counts
- submitted counts
- interviews
- acceptances
- completed opportunities
- activity dates
- top category
- milestones
- rankings
- streaks
- scores

## Privacy

Journey Cards default to safe sharing.

They never include:

- GPA
- email
- private application notes
- rejected opportunities
- internal recommendation evidence

Optional controls allow users to hide:

- school
- major
- milestones
- opportunity names

The card uses the public domain `unlockededu.com`.

## Export and Share

The preview is generated from the same SVG used for export. PNG export renders the SVG into a canvas at:

- `1080 x 1920` for Story/TikTok
- `1080 x 1080` for square social posts

Sharing uses the Web Share API when supported. If native file sharing is unavailable, the fallback copies `https://unlockededu.com`.

## Analytics

College Journey events intentionally avoid sensitive profile values.

Tracked events:

- `college_journey_summary_viewed`
- `journey_card_generator_opened`
- `journey_card_format_changed`
- `journey_card_theme_changed`
- `journey_card_privacy_changed`
- `journey_card_generated`
- `journey_card_downloaded`
- `journey_card_share_started`
- `journey_card_share_completed`
- `journey_card_copy_link_clicked`
- `milestone_share_prompt_viewed`
- `milestone_share_prompt_clicked`

## Validation

Run:

```bash
npm run check:college-journey
```

The check verifies catalog coverage, privacy language, export formats, analytics names, and Journey Board preservation markers.
