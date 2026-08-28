# Personal Opportunity Strategy

## Role

Personal Opportunity Strategy is a private, deterministic projection that explains how a student's current opportunities fit together. It does not rank choices, predict outcomes, prescribe an ideal mix, or persist a second copy of Journey state.

- **For You:** what fits the student.
- **Journey:** what the student is pursuing.
- **Applications:** what needs work.
- **Calendar:** when recorded events happen.
- **Strategy:** how current choices overlap and differ.

The full view lives inside Journey. For You and Opportunity Detail use the same projection for one concise `What this adds` line.

## Authoritative sources

Watch records are `considering`; non-terminal Journey records are `pursuing`; Applying, Submitted, Interview, and Accepted records are `actively applying`. Rejected and Completed records provide historical context only. Calendar Intelligence supplies deadline clusters, Opportunity Paths supplies deterministic stage relationships, Materials and Resume Lab supply preparation context, and Accomplishments supplies factual background.

Canonical opportunity IDs deduplicate an opportunity as it moves from Watch to Journey to an application state. No Strategy data is persisted, exported separately, or made public.

## Projection architecture

`createOpportunityStrategyContext()` builds request-scoped indexes from the bounded opportunities already needed by the page. `buildPersonalOpportunityStrategy()` projects the Journey view. `projectOpportunityStrategyContribution()` explains a candidate relative to the same context for For You and Opportunity Detail.

Journey and Opportunity Detail load only account-relevant IDs. For You reuses its existing in-memory catalog index, while Strategy reads only account IDs and final recommendations.

## Similarity

Candidate pairs come from inverted buckets instead of a full all-pairs catalog comparison. Deterministic internal weights are: same type 2, same field 2, same organization 3, same Path stage 2, shared known requirement shape 1, and same delivery mode 1. Pairs at 5 or more form connected groups. The score is never shown. The UI gives factual reasons and never calls related records duplicates unless canonical identity says they are the same record.

## Novelty, timing, and goals

Novelty has no composite score. Context may identify a first current type, new field, or new organization, but it does not alter ranking. Deadline overlap uses only verified dates and the Journey view reuses Calendar Intelligence's seven-day clusters. Goal context appears only for explicitly followed Paths and uses existing Path rules.

Materials context appears only when known reusable requirements are verified and represented by recorded Materials. Resume context appears only for an existing targeted resume. Missing data is omitted instead of shown as a fake zero.

## Free and Pro

Free accounts retain owned Journey data, the current mix, and deadline context. Pro adds similarity groups, followed-Path context, and candidate contribution explanations in For You and Opportunity Detail. Core application state remains under existing product rules.

## Privacy and analytics

Strategy is authenticated, account-isolated, server-derived, non-indexable, and private. It adds no public route or store. Analytics may use bounded action tokens such as `strategy_opened` or `strategy_to_opportunity`; titles, organizations, goals, statuses, materials, and outcomes must never be sent.

## Limitations

- Field labels use existing career paths, research areas, majors, and categories in that order; sparse metadata can yield broad labels.
- Manual Journey records without a catalog ID cannot receive fabricated taxonomy.
- Similarity is conservative and does not use embeddings.
- Strategy never infers interest from rejection or predicts outcomes.
