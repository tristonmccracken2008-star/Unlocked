# UnlockED visual fidelity audit

Audit completed September 2, 2026 against the approved UnlockED workspace mockup.

## Matched deliberately

The implementation now matches the reference in the features that define its identity: cool neutral canvas, dark editorial ink, forest-green emphasis, subtle multi-color ambience, bounded floating header, translucent navigation/search controls, restrained border hierarchy, compact status chips, low-contrast depth, serif workspace headings, and tight sans-serif utility copy.

For You now follows the mockup's hierarchy of personalized introduction, shortlist heading, one elevated lead recommendation, and quieter supporting recommendations. Journey follows the reference's next-action, attention, active-opportunity, date, and history sequence. Build uses the same editorial composition for reusable materials. Discover, Applications, account settings, opportunity families, and public pages inherit the shared system rather than carrying isolated palettes.

## Page-by-page result

- Discover: aligned canvas, header, search treatment, chips, card density, and green action language. The live catalog keeps its existing three-column desktop result grid because that is a real browsing workflow absent from the composite reference.
- For You: aligned title scale, star detail, top-pick elevation, action stack, reasons, and row rhythm. A transition defect that temporarily overlaid restored rows was removed.
- Journey: closest structural match to the reference, including the primary next action, needs-attention band, active list, compact filters, and calendar/strategy continuation.
- Build and Resume Lab: aligned hero scale, staged navigation, elevated next action, resume inventory, experience bank, and material reuse.
- Applications: retains the existing factual, higher-density work queue while using the new canvas, type, surfaces, dividers, controls, and dark-mode hierarchy.
- Explorer, Collections, Paths, Planner, opportunity detail, Learn, Profile, Billing, and notifications: preserved their information architecture while adopting the shared reference tokens and moderated title scale.

## Intentional deviations

The mockup is a composite design-board view, while the product exposes each area as a complete route. The implementation does not force all workspaces into one simultaneous dashboard. Existing information architecture, URLs, authentication, account isolation, application mutations, recommendation logic, catalog density, and progressive disclosure remain intact.

The production header retains Profile, account name, and sign-out affordances required by current behavior. Opportunity results remain ordinary surfaces instead of glass cards. Dense Applications data stays tabular/list-like rather than being reduced to the smaller sample in the mockup. Mobile uses the existing destination model as a compact bottom bar because the reference only defines desktop chrome.

No custom Satoshi or Inter webfont payload was introduced. The typography uses locally available/system fallbacks to protect startup performance and avoid layout shift. This is the largest remaining platform-dependent visual difference from the reference.

## Theme and accessibility review

Light, Midnight, Forest, and System modes share geometry and semantic roles. Midnight was changed from a high-saturation tech treatment to calm blue-black surfaces. Measured dark-mode contrast includes 16.19:1 primary text on canvas, 11.71:1 secondary text, 7.56:1 muted text, 13.07:1 primary text on surfaces, 9.15:1 forest emphasis, and 8.78:1 gold emphasis. The light Journey green contrast check is 4.67:1.

Focus visibility, keyboard navigation, native semantics, 44px touch targets, reduced motion, responsive reflow, and fixed-navigation clearance were retained. Chromium and WebKit browser suites covered 390, 640, 1280, 1440, and 1728px layouts plus a 200%-equivalent 720px reflow state.

## Validation record

Passed during this implementation:

- lint and visual-language static checks
- Journey visual, dark-theme, accessibility, path-moment, and semester-story checks
- full-app performance browser suite across desktop, narrow desktop, tablet, and mobile
- Applications and product-cohesion suite in Chromium and WebKit, including 390px, 1728px, 200% reflow, dark mode, reduced motion, account isolation, and task mutation
- Build and Resume Lab suite in Chromium and WebKit, including mobile, dark mode, print, reduced motion, and account isolation
- Journey command-center suite in Chromium and WebKit across empty, rich, 100-active, and 500-history data
- Explorer, Collections, and Paths suites in Chromium and WebKit across signed-out, plan, theme, mutation, failure recovery, and responsive states
- Account center in Chromium and WebKit, including three accounts, mobile, 200% reflow, account switching, theme, retryable save failure, and deletion

The final source CSS is approximately 408 KB across `app` and `components`, compared with approximately 404 KB at the start of this pass. The increase is the global semantic-token and theme compatibility layer; no new visual JavaScript dependency or media payload was added.

## Remaining inconsistencies

Some legacy route-level CSS still declares fallback beige literals for isolated print or no-token contexts. Active product themes override them, but future maintenance should migrate those fallbacks to semantic tokens. Page titles vary slightly by route because long names must wrap safely and dense application views need more compact composition. Browser font availability can change serif metrics by a few pixels. These differences do not change hierarchy or behavior.
