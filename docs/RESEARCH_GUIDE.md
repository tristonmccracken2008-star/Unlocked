# Research opportunity maintenance

Undergraduate research programs are unified Opportunity records with `type: "Research"`. Core eligibility, school scope, majors, years, deadline, location, paid status, format, source, verification, difficulty, and prestige use the shared model.

Research-specific metadata includes:

- `professor`: named faculty lead when an official source identifies one; otherwise `null`
- `department`
- `researchArea`
- `stipendAmount`: numeric amount only when officially published; otherwise `null`
- `semesters`: one or more of `Summer`, `Fall`, and `Spring`
- `deadlineType`, `compensation`, and `workMode`

Never infer a stipend or reuse a prior-cycle deadline. Use `application_deadline: null` and `not_announced` until a current official source publishes the date. School-specific research must include explicit school slugs.

The Research dashboard ranks national opportunities and programs verified for the student’s school. Major and academic-year matches affect ranking but never alter eligibility.
