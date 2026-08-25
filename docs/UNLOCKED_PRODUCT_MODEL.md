# UnlockED Product Model

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
| Application Command Center | What do I need to do for this application? | Detailed verified requirements, Material selections, and private tasks for one application. |
| Materials | What can I reuse? | Private material records and selections for verified application requirements; no document storage. |
| Calendar | When? | Official and student-managed dates. |
| Radar | What changed? | Meaningful lifecycle and recommendation updates. |
| Accomplishments | What have I done? | Private successful-outcome history. |
| Insights | What does my history show me? | Private, factual projection of recorded history; no editing, prediction, or peer comparison. |

## State ownership

- Interesting but not being pursued: **Watch**.
- Actively being pursued: **Journey**.
- Cross-application execution: **Applications**.
- A date or reminder: **Calendar**.
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

Applications is a projection over Journey lifecycle records, Application Command Center tasks, Materials associations, verified catalog requirements and deadlines, and provider changes. It has no separate account store. An opportunity enters active preparation after the student chooses or starts it, and submitted/interviewing records move to the waiting presentation. Accepted, completed, withdrawn, rejected, archived, saved-only, and non-application resources remain outside active execution.

"Ready" means every currently verified requirement recorded by UnlockED is complete, every mapped reusable Material has a Ready version explicitly selected, and no incomplete private task remains. It never means UnlockED knows every provider requirement, submitted the application, or guarantees acceptance. Records with no verified requirements are explicitly neutral and never Ready.

Materials may appear inside Applications or an individual Application Command Center, but Journey remains the source of truth for whether the opportunity is actively pursued. Selecting a Material does not complete a task or change an application status. Calendar remains authoritative for dates, while Applications only projects verified application deadlines and private task dates relevant to active execution.

Insights stores no duplicate lifecycle history. It derives a read-only projection from Journey, outcomes, Accomplishments, Materials, Paths, and current Watch state. Planner owns the future; Insights summarizes the past that UnlockED actually recorded.
