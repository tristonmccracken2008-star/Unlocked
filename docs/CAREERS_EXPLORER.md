# Careers Explorer

Careers is a protected Discover destination at `/careers`, with detail pages at `/careers/[slug]`. It is exploratory guidance, not a personalized recommendation engine, and it does not alter For You ranking or profile state.

## Data model

`data/careers.ts` is the canonical, versioned catalog. Its 181 records have stable IDs and slugs, intent-oriented discovery tags, category, practical responsibilities, weekly-hours and schedule orientation, compensation structure and drivers, education, majors, grouped skills, seven qualitative intensity dimensions, work environment, entry routes, trajectory branches and adjacent exits, surprises, low-commitment trials, a six-part college exploration plan, outlook drivers and risks, separate AI resilience and upside analysis, related careers, opportunity search terms, source metadata, and an update date.

Specialized titles are mapped to the closest defensible broader occupation. The profile says when it uses a proxy. U.S. pay represents May 2024 national median wage data surfaced in current BLS Occupational Outlook Handbook profiles; projections cover 2024–34. Early-career and experienced ranges are withheld until direct percentile evidence is mapped; they are never derived mechanically from the median. Variable-pay paths distinguish the government occupational median from bonuses, commissions, or total compensation. Hours are directional ranges informed by O*NET work context and occupational norms, never promises.

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

AI exposure is task-level, not a claim that a job will disappear. Each record separates AI use today, more- and less-exposed tasks, workflow change, displacement risk, productivity upside, and skills gaining value. The 5–10 year framing is directional and explicitly notes uncertainty from capability, adoption, regulation, and employer choices.

## Sources

- U.S. Bureau of Labor Statistics Occupational Outlook Handbook and 2024–34 Employment Projections
- O*NET OnLine 30.1 tasks, skills, and work-context taxonomy
- ILO–NASK, *Generative AI and Jobs: A Refined Global Index of Occupational Exposure* (2025)
- OECD AI exposure measure (2026)

Each profile carries direct source URLs, the source year, and the fields the source supports.

## Product behavior

The catalog supports intent-like structured search, major and skill discovery, intensity and practical filters, deterministic sorting, editorial collections, pagination, and a 2–4 career comparison with a difference-first summary. Universal Search indexes public career metadata and routes directly to detail pages. Detail pages can show related Discover opportunities only after the existing `recommendationSafe` classifier approves them; these are labeled as related records, not personalized matches.

## Maintenance

Run `npm run check:careers` after editing the catalog or grading logic. Re-check BLS mappings and figures when a new wage or projections release appears, update each affected `updatedAt`, and keep old values out of prose. Keep aliases and search terms concise. Never add an unsupported quantitative claim just to fill a field.
