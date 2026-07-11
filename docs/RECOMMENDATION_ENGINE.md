# Recommendation Engine

UnlockED ranks every record in `data/db/opportunities.json` against the student profile saved in the browser. Recommendations are never maintained as a separate hand-picked list.

## Profile signals

The scorer in `data/recommendations.ts` uses school, major, academic year, optional interests, optional career goals, the school's location, opportunity tags, and opportunity type. School-specific records that do not belong to the selected school receive a strong penalty. Exact school, major, and year matches receive the largest positive weights.

The final top ten uses a three-item-per-type cap. This prevents one dense catalog type from crowding every other relevant opportunity out of the dashboard.

## Dashboard collections

- **Recommended For You:** the ten highest relevant scores with type diversity.
- **Trending Opportunities:** a deterministic blend of catalog `featured`, prestige, verification, and profile relevance signals. This is editorial trending, not behavioral analytics.
- **Hidden Gems:** verified, relevant opportunities that are explicitly marked `hidden_gem` or are strong non-featured records without `Very High` prestige.
- **Expiring Soon:** real application deadlines from today through the next 60 days. The section stays empty when no valid deadline qualifies.
- **Recently Added:** newest `date_added` values, with relevance used to break ties.

## Adding data

Every opportunity must include an ISO `date_added` value (`YYYY-MM-DD`). Add or edit the opportunity normally, then run `npm run validate:data` and `npm run build`. The opportunity becomes eligible for every recommendation collection automatically. Do not add opportunity IDs to the recommendation code.

## Changing weights

Weights are centralized in `scoreOpportunity`. Keep school and eligibility constraints stronger than soft text matches. When changing weights, test technical, business, humanities, first-year, and upper-year profiles to ensure one catalog type does not dominate.

## Advisor and Interview Intelligence integration

The Advisor systems use `data/recommendation-engine.ts` as structured input rather than a separate hand-written recommendation list. Internal Interview Intelligence consumes `RecommendationV1` records, Student Progress, the Evidence Inventory, and the Student Digital Twin to decide which interview stories and practice actions are currently supported by evidence.

This integration is deterministic. It does not call an AI API and it does not produce interview advice from free-form generation. See `docs/INTERVIEW_INTELLIGENCE.md` for the architecture and test command.
