# UnlockED Product Model

## Student-facing model

UnlockED presents four stable product domains: **Discover**, **For You**, **Journey**, and **Build**. Discover groups Search, Explore, Collections, and Paths. Journey groups active pursuit, Applications, Planner, and Calendar. Build groups Resume Lab and Materials. Accomplishments and Insights form secondary History views.

Students should experience one continuous flow: find an opportunity, add it to Journey, prepare the application, build or select reusable materials, track dates, record the outcome, and reuse the resulting experience. Internal projections and stores must not become additional user-facing products.

Each product area owns one primary student question.

| Feature | Primary question | Boundary |
| --- | --- | --- |
| Discover | What exists? | Comprehensive catalog search and filtering. |
| Explore | What possibilities have I not considered? | Structured fields and experience types that broaden awareness, then hand off to Discover or Paths. |
| Collections | Where should someone in my situation start? | Curated, quality-gated starting points that hand off to Discover, Paths, Watch, or Journey. |
| For You | What fits me? | Personalized, eligibility-gated priorities. |
| Paths | How can opportunities connect to a goal? | Structured exploration; never an active-work tracker. |
| Watch | What am I monitoring? | Passive interest in a future or changing opportunity. |
| Planner | What is coming? | Time-based summary of verified dates and relevant activity. |
| Journey | What am I pursuing? | Single source of truth for active opportunity progress. |
| Applications | What needs attention across my active applications? | Server-derived overview of requirements, tasks, Materials, verified deadlines, and provider changes. It stores no duplicate application state. |
| Application details | What makes up this application, and what remains? | The single user-facing detail view for verified requirements, selected Material versions, private tasks, timing, and submission history. Internally projected by the Application Packet module. |
| Materials | What can I reuse? | Private material records and selections for verified application requirements; no document storage. |
| Calendar | When? | Official and student-managed dates. |
| Conflict Planning | Where are my dates bunching together? | Read-only Calendar Intelligence over verified provider dates, private tasks, Materials context, and watched openings. It owns no dates. |
| Radar | What changed? | Meaningful lifecycle and recommendation updates. |
| Accomplishments | What have I done? | Private successful-outcome history. |
| Insights | What does my history show me? | Private, factual projection of recorded history; no editing, prediction, or peer comparison. |

## State ownership

- Interesting but not being pursued: **Watch**.
- Actively being pursued: **Journey**.
- Cross-application execution: **Applications**.
- A date or reminder: **Calendar**.
- Concentration across existing dates: **Conflict Planning** inside Calendar.
- A future time-based view: **Planner**.
- Goal-oriented exploration: **Paths**.
- Broad possibility discovery: **Explore**.
- A curated starting point: **Collections**.
- Personalized priority: **For You**.
- Completed or earned outcome: **Accomplishments**.
- A reusable resume, essay, transcript, or related record: **Materials**.
- A summary of past activity and patterns: **Insights**.

Paths may display Watch, Journey, and Accomplishment state, but it never owns or duplicates those records. Following a Path is only a return preference; it does not add opportunities to Journey or modify profile goals.

Explorer may display existing Watch, Journey, and Accomplishment state, but it stores no view history and infers no permanent preference from opening an area. Curated adjacency broadens awareness; it is not a personal recommendation claim. Deeper lists always hand off to Discover, while goal-oriented structure remains in Paths.

Collections are deterministic catalog projections, not personalized recommendations or a separate saved state. A collection launches only when its safety, breadth, organization diversity, lifecycle, and any collection-specific eligibility or deadline gates pass. Opening one stores no preference. Watch and Journey remain the only intent states, and Discover remains the complete catalog.

Applications is a projection over Journey lifecycle records, application tasks, Materials associations, verified catalog requirements and deadlines, and provider changes. It has no separate account store. An opportunity enters active preparation after the student chooses or starts it, and submitted/interviewing records move to the waiting presentation. Accepted, completed, withdrawn, rejected, archived, saved-only, and non-application resources remain outside active execution.

"Ready" means every currently verified requirement recorded by UnlockED is complete, every mapped reusable Material has a Ready version explicitly selected, and no incomplete private task remains. It never means UnlockED knows every provider requirement, submitted the application, or guarantees acceptance. Records with no verified requirements are explicitly neutral and never Ready.

Materials may appear inside Applications or an individual application detail view, but Journey remains the source of truth for whether the opportunity is actively pursued. Selecting a Material does not complete a task or change an application status. Calendar remains authoritative for dates, while Applications only projects verified application deadlines and private task dates relevant to active execution.

Insights stores no duplicate lifecycle history. It derives a read-only projection from Journey, outcomes, Accomplishments, Materials, Paths, and current Watch state. Planner owns the future; Insights summarizes the past that UnlockED actually recorded.

Conflict Planning stores no dates or conflict records. It derives short-horizon clusters from Calendar, active Applications, application tasks, Materials readiness, verified provider changes, and Watch. Calendar remains authoritative for every displayed date; Applications and Materials remain authoritative for their context.
## Resume Lab

Resume Lab turns confirmed Accomplishments and manually entered experience facts into master and targeted resume versions. It complements Materials rather than replacing it: Resume Lab owns composition and evidence, while Materials owns application associations and reusable-material status. See `docs/RESUME_LAB.md`.

## Application detail projection

The internal Application Packet projection powers the single user-facing **Application details** view. It stores no packet readiness or duplicate status. Journey owns lifecycle and submission; Application Workspace owns tasks; Materials owns records and selections; Resume Lab owns resume content; Calendar owns dates; Opportunity Changelog owns provider changes. See `docs/APPLICATION_PACKETS.md`.

The navigation and language guardrails are documented in `docs/PRODUCT_COHESION_AND_UX.md`.
