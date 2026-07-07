# Scholarship opportunity maintenance

Scholarships are unified Opportunity records with `type: "Scholarship"`.

The shared model stores organization, description, eligibility, majors, academic years, school scope, schools, deadline, official source, verification date, difficulty, tags, and numeric `estimated_value` when an official fixed amount is available.

Scholarship metadata includes:

- `awardAmountLabel`: the official amount or `Amount varies`
- `renewable`: `true`, `false`, or `null` when terms vary
- `applicationRequirements`: a concise list supported by the official source
- `deadlineType`: use `varies` when no current deadline is published

Never reuse a prior application cycle’s deadline. If the current official source does not publish a date, keep `application_deadline` null; the UI will display `Deadline varies`.

University-specific scholarships must include the exact school slug. Broad institutional financial-aid pages should be described as scholarship or grant resources, not as guaranteed awards.

Run `npm run validate:data` and `npm run build` after every update.
