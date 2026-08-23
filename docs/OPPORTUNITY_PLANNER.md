# Opportunity Planner

Planner answers three bounded questions: what matters now, what has a verified date ahead, and which opportunity categories are represented in the student's current activity. It is a map across time, not another recommendation feed, Journey, or Calendar.

## Projection

`buildOpportunityPlanner()` is a deterministic server-side projection. It combines the canonical Journey projection and Calendar dates with Pro-authorized For You recommendations and Watch records. The browser receives only the small rendered model, never the catalog or recommendation engine.

Relationships are deduplicated in this order: **Journey (Pursuing) > Watch (Watching) > For You (Recommended)**. Completed and closed Journey records do not enter active planning. Application workspaces contribute only their nearest unfinished dated task.

## Time and uncertainty

Year Ahead contains exact dates that pass the existing Calendar deadline rules or equally strict lifecycle-opening rules. Historical recurrence months, past cycle dates, estimated dates, and unknown deadlines never become timeline markers. A recurring watched program without a confirmed future date appears separately as **Next cycle not announced**.

Planner reads Journey Calendar output rather than storing duplicate deadlines. Catalog date corrections therefore flow into Calendar and Planner from the same source.

## Opportunity Mix

Mix is a neutral count of the strongest current relationship by canonical category. It does not score, judge, or tell a student to diversify. Areas to Explore appear only when Pro has approved matches in a category with no Journey or Watch relationship, and hand off to Discover.

## Free and Pro

Free students receive Now, Year Ahead, and mix summaries for their Journey. Pro adds approved personalized matches, Watch lifecycle planning, cycle monitoring, category exploration, and preparation information sourced from verified application pages. No projection data is persisted.
