# Discover experience

Discover is UnlockED's user-controlled catalog. It does not use profile data, saved activity, or recommendation scores. Personalized ranking belongs in For You.

## Interaction modes

- **Specific search:** title, organization, subject, acronym, alias, and typo-aware retrieval.
- **Guided exploration:** catalog-backed paths for scholarships, internships, research, fellowships, tools, and benefits.
- **Blank browsing:** the complete canonical catalog, ordered by quality and current availability.

Search and filter state is encoded in the URL and retained for same-session back navigation. Results are requested through a bounded server projection; Discover never downloads the complete catalog into the browser.

## Ranking and trust

Ranking is deterministic. Exact title and organization matches lead, followed by subject relevance and catalog quality. Archived, duplicate, broken-source, and expired records are suppressed. Unconfirmed deadlines are displayed honestly and never receive deadline-sort priority.

Search aliases cover common student language and acronyms. Typo recovery is vocabulary-bounded. No LLM, profile signal, fake popularity score, or hidden behavior ranking is used.

## Filters

Primary filters use dependable catalog dimensions: opportunity type, category, and lifecycle availability. School, major, value, format, difficulty, and first-year friendliness are progressively disclosed because their coverage varies across the catalog. Filter counts are contextual to the current search and other active constraints.

Zero-result recovery removes only a real active constraint and reports the resulting count. Search-only zero states offer a clear reset; the interface does not invent matches.

## Exploration chains

Opportunity detail pages expose up to three deterministic similar opportunities. Similarity uses category, type, tags, majors, career paths, source trust, and lifecycle state. These links are catalog navigation, not personalized recommendations.

## Verification

Run:

```bash
npm run check:discover
npm run test:app-performance-browser
```

The regression suite covers exact search, natural-language aliases, acronyms, typo handling, multidisciplinary personas, conflicting filters, canonical deduplication, lifecycle suppression, confirmed-deadline sorting, deterministic ordering, performance, related-opportunity safety, URL state, keyboard behavior, scroll restoration, and Chromium/WebKit rendering.

## Deliberate exclusions

Recent searches and a separate autocomplete menu were not added. Results already update immediately as the user types, and another suggestion surface would compete with the catalog without improving retrieval. Popularity labels are excluded because UnlockED does not have a defensible popularity signal.
