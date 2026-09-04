# Careers Explorer

Careers is a protected Discover destination at `/careers`, with detail pages at `/careers/[slug]`. It is exploratory guidance, not a personalized recommendation engine, and it does not alter For You ranking or profile state.

## Data model

`data/careers.ts` is the canonical, versioned catalog. Every record has a stable ID and slug, aliases, category, description, responsibilities, weekly-hours orientation, education, majors, grouped skills, entry roles, progression, work characteristics, eight letter-grade dimensions, separate AI resilience and upside analysis, related careers, opportunity search terms, source metadata, and an update date.

Specialized titles are mapped to the closest defensible broader occupation. The profile says when it uses a proxy. U.S. pay represents May 2024 national median wage data surfaced in current BLS Occupational Outlook Handbook profiles; projections cover 2024–34. Pay and hours are orientation ranges, never promises. Missing data is shown explicitly rather than fabricated.

## Deterministic grading

`buildGrades` uses fixed inputs and thresholds, so the same record always produces the same grade. The interface exposes A+ through F rather than false-precision decimals and always pairs a grade with its basis.

- Compensation uses the mapped national median.
- Job market uses BLS projected employment change.
- Work-life balance uses typical hours plus broad schedule burden.
- Entry accessibility uses common education and recruiting competition.
- Stability uses occupational necessity, accountability, and demand direction.
- AI resilience rewards physical presence, trust, interpersonal complexity, accountability, and non-routine judgment while discounting routine digital task share.
- AI upside measures potential complementarity: how much tools can accelerate work while a person retains responsibility.
- Long-term outlook combines market, stability, resilience, and upside.

AI exposure is task-level, not a claim that a job will disappear. The 5–10 year framing is directional and explicitly notes uncertainty from capability, adoption, regulation, and employer choices.

## Sources

- U.S. Bureau of Labor Statistics Occupational Outlook Handbook and 2024–34 Employment Projections
- O*NET OnLine 30.1 tasks, skills, and work-context taxonomy
- ILO–NASK, *Generative AI and Jobs: A Refined Global Index of Occupational Exposure* (2025)
- OECD AI exposure measure (2026)

Each profile carries direct source URLs, the source year, and the fields the source supports.

## Product behavior

The catalog supports broad-text search, category and practical filters, deterministic sorting, quick collections, pagination, and a 2–4 career comparison. Universal Search indexes public career metadata and routes directly to detail pages. Detail pages can show related Discover opportunities only after the existing `recommendationSafe` classifier approves them; these are labeled as related records, not personalized matches.

## Maintenance

Run `npm run check:careers` after editing the catalog or grading logic. Re-check BLS mappings and figures when a new wage or projections release appears, update each affected `updatedAt`, and keep old values out of prose. Keep aliases and search terms concise. Never add an unsupported quantitative claim just to fill a field.
