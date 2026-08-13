# Product Coherence Audit

## Product model

- **Discover** is the complete catalog and does not imply personalization.
- **For You** is a selective, eligibility-gated shortlist.
- **Journey** is the private record of opportunities a student is pursuing.
- **Application Command Center** contains the work required for one Journey opportunity.
- **Calendar** combines verified official dates with clearly labeled personal dates and application tasks.
- **Notifications** surface meaningful changes and return students to the relevant object.

## Inconsistencies found and fixed

- The same action was labeled both **Save to Journey** and **Add to Journey**. Catalog, recommendation, detail, and Journey entry points now use **Add to Journey**, followed by **Added to Journey**.
- Post-add feedback previously linked to the top of Journey. **View in Journey** now targets the exact opportunity record so identity and context survive the transition.
- For You used **Review** while Discover used **Open Opportunity**. Both browsing surfaces now use **Open Opportunity** for the same destination.
- Journey overflow controls were announced as **View details**, although they opened an action/detail surface. They are now announced as **More actions**; the actual destination link is **View opportunity**.
- Journey called the deeper workflow an **Application workspace** in one place and **Application Command Center** elsewhere. The user-facing name is now consistent while internal type names remain unchanged.
- Journey’s official-source action now follows the product-wide **View official source** external-link language.
- The updates page had a legacy **Dashboard / What’s New** breadcrumb. It now uses **Journey / Opportunity updates**.

## Shared continuity verified

The regression check projects a representative verified opportunity through Journey, Application Command Center, and Calendar. It asserts that title, organization, opportunity ID, and official deadline stay canonical. Official dates remain distinct from editable personal dates.

## Intentional differences preserved

- Discover remains wider and denser than For You, Opportunity Detail, Notifications, and Profile.
- For You keeps recommendation-specific fit signals that disappear after an opportunity enters Journey.
- Journey uses compact workflow rows; Opportunity Detail keeps a readable editorial layout.
- “Open official application,” “View official offer,” and “View official source” remain distinct because they describe different provider actions.
- Application and Calendar retain specialized controls instead of being forced into one generic card or dialog abstraction.

## Legacy patterns reviewed

Current authenticated surfaces already use the shared loading, action-feedback, Undo, empty-state, organization-branding, and same-origin request systems. No replacement architecture was added. Internal identifiers such as `applicationWorkspace` and existing analytics event names remain for compatibility.

## Validation completed

- The complete prebuild chain, TypeScript compilation, 80-page production render, and postbuild bundle audits pass.
- Chromium and WebKit pass the Journey, first-session, universal-search, return-experience, notification, account-center, and opportunity-lifecycle browser suites.
- Browser coverage includes desktop, tablet, mobile, keyboard operation, reduced motion, account switching, and 200% reflow-equivalent layouts.
- The Journey command-center large-data suite passes with 100 active and 500 historical records.
- The final production bundle audit reports five chunks for Discover and Journey and four for For You; the largest shared product chunk remains 90,877 bytes.

## Remaining issues

- Native popover behavior depends on current Chromium and WebKit support; browser suites remain the regression guard.
- Some older public catalog subsections use legacy editorial link labels. They are outside the authenticated Discover → Journey workflow and should be handled as a separate content-template cleanup.
- Browser Back/Forward state is session-scoped by design; a new browser session intentionally starts from canonical defaults.

## Not implemented

No new dashboard, assistant, social surface, recommendation system, navigation destination, or workflow was added. A dedicated full-page Application Command Center and a global updates destination could be evaluated later, but neither is necessary for the current continuous workflow.
