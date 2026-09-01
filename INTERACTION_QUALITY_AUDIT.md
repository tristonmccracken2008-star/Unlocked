# UnlockED Interaction Quality Audit

## Scope and Method

This pass audited the production public site, the local application, code paths for Discover, Explore, Collections, Paths, For You, Opportunity Detail, Watch, Journey, Applications, Application Details, Calendar, Planner, Strategy, Build, Experience Bank, Resume Lab, Materials, Accomplishments, Insights, Universal Search, notifications, profile/settings, authentication, onboarding, menus, disclosures, dialogs, forms, loading, error, and success states.

The current codebase contains 33 CSS files with animation or transition rules, 43 files with explicit reduced-motion behavior, four focused Web Animations implementations, and no View Transitions implementation. The dependency graph contains React and Next.js only at runtime; neither Motion nor Framer Motion was installed.

## Before: Material Problems

| Surface | Before problem | Risk |
| --- | --- | --- |
| Global page content | every main/section entered with a generic page fade/translation | route navigation felt slower and motion had no state meaning |
| Discover results | every direct result child animated on appearance | unbounded work for large catalogs and visual noise |
| Generic cards | broad hover lift covered cards that were not themselves clickable | false affordance and excessive movement |
| Add to Journey | flight, eight-particle burst, duplicate floating confirmation, card pulse, destination pulse, and vibration | routine save felt celebratory, duplicated acknowledgement, assumed haptics |
| Journey updated row | highlight lasted 1.8 seconds | feedback lingered well after comprehension |
| For You Watch | text switched abruptly without stable icon continuity | flagship state change felt generic |
| Application tasks | optimistic completion could reorder rows without spatial continuity | identity was harder to follow |
| Materials and Resume Lab | item/status and version changes teleported | creative workspace felt less cohesive |

## Implemented

- Added exact shared tokens for instant, fast, standard, and deliberate transitions.
- Added a reduced-motion-aware, bounded FLIP helper for small keyed lists.
- Applied list continuity to For You shortlists and Watching, application requirements/tasks, Materials groups, and resume versions.
- Added Watch bookmark-to-check continuity with stable button dimensions and existing ARIA pressed state.
- Added restrained presence to comparison tray/panel, application readiness/submission, and resume editor switching.
- Reduced Journey row and overview acknowledgement to 320 ms.
- Simplified Add to Journey to the existing authoritative inline state plus a 360 ms destination cue. Removed particles, duplicate chip, and vibration.
- Removed global page entrance animation, per-result entrance animation, and broad non-clickable card lift.
- Preserved focus, keyboard, touch-target, optimistic rollback, idempotency, server authority, and account isolation behavior.

## Intentionally Static

Body copy, opportunity descriptions, eligibility and trust evidence, source disclosures, dense tables, legal/privacy content, Discover's large result list, static metadata, long application material copy, and authenticated app content on scroll remain static. No marketing background effect was added; the existing public page already meets the idle test without additional choreography.

## Dependencies and Bundle

No dependency was added. Motion, Framer Motion, Kokonut UI, Bklit UI, Aceternity UI, Cult UI, and 21st.dev packages were intentionally avoided. The implementation reuses React, CSS, and the browser Web Animations API. Baseline primary route inspection before the pass reported five Journey chunks, five Discover chunks, three Explorer chunks, three Collections chunks, and four For You chunks; the largest shared route chunk was 90,877 bytes.

## Browser and Accessibility Findings

- Public production and local pages preserve the calm visual identity and have no generic `main` entrance animation after the pass.
- Chromium public-page inspection showed no horizontal overflow at the effective 1280 px viewport and 44 px minimum heights on sampled primary focusables.
- The code path includes normal and account-level reduced motion, focus-visible rings, 44 px controls, explicit ARIA pressed/busy/live states, and focus restoration for application popovers.
- WebKit-specific regression coverage remains in the existing Playwright suites for For You, Journey, applications, Materials, Resume Lab, and Universal Search.

## Remaining Weak Interactions

- Cross-route shared-element transitions were intentionally skipped; route identity and browser support do not yet justify the complexity.
- Native `details` height interpolation remains browser-dependent; content entrance is stable but not every disclosure animates intrinsic height.
- Journey rows rendered after a server navigation receive a fast confirmation treatment rather than a true cross-route FLIP.
- Authenticated production personas require a signed-in test account; fixture-backed Chromium/WebKit suites provide the repeatable coverage in this repository.

## Validation Record

- `npm run build` passed on September 1, 2026, including the full prebuild regression suite, optimized Next.js compilation, 80 statically generated pages, and postbuild verification.
- Primary route bundle gates passed with no chunk-count or largest-chunk regression: Journey 5 / 90,877 bytes; Discover 5 / 90,877 bytes; Explorer 3 / 52,613 bytes; Collections 3 / 52,613 bytes; For You 5 / 52,613 bytes. The prior For You baseline reported four chunks; the current manifest reports five, while its largest route chunk remains 52,613 bytes and below the shared 90,877-byte ceiling. Total generated static chunks measured 20,420 KB versus the 20,404 KB baseline (+16 KB, 0.08%).
- Focused Chromium and WebKit browser suites passed for Universal Search, Applications, Resume Lab, Journey Command Center, and full-app performance, including desktop, tablet, mobile, zoom, dark-mode, reduced-motion, account-isolation, large-data, and workflow scenarios where applicable.
- Two legacy browser commands remain fixture-blocked rather than motion-regressed: Application Materials expects an obsolete Community College Internships continuation fixture, and Journey Polish reaches the first-launch `/welcome` flow instead of its older Journey persona. Their assertions were not weakened.
- `npm run lint`, `check:global-ux`, `check:product-polish`, `check:microinteractions`, `check:save-to-journey`, and the affected product checks passed.
