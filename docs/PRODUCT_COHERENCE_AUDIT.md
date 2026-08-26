# Product Coherence Audit

## Product model

- **Discover** is the complete catalog and does not imply personalization.
- **For You** is a selective, eligibility-gated shortlist.
- **Journey** is the private record of opportunities a student is pursuing and the parent for Applications, Planner, and Calendar.
- **Application details** contains the work required for one Journey opportunity.
- **Build** is the parent for Resume Lab and Materials.
- **Calendar** combines verified official dates with clearly labeled personal dates and application tasks.
- **Notifications** surface meaningful changes and return students to the relevant object.

## Inconsistencies found and fixed

- The same action was labeled both **Save to Journey** and **Add to Journey**. Catalog, recommendation, detail, and Journey entry points now use **Add to Journey**, followed by **Added to Journey**.
- Post-add feedback previously linked to the top of Journey. **View in Journey** now targets the exact opportunity record so identity and context survive the transition.
- For You used **Review** while Discover used **Open Opportunity**. Both browsing surfaces now use **Open Opportunity** for the same destination.
- Journey overflow controls were announced as **View details**, although they opened an action/detail surface. They are now announced as **More actions**; the actual destination link is **View opportunity**.
- Journey called the deeper workflow an **Application workspace** in one place and **Application Command Center** elsewhere. The user-facing name is now **Application details** while internal type names remain unchanged.
- Journey’s official-source action now follows the product-wide **View official source** external-link language.
- The updates page had a legacy **Dashboard / What’s New** breadcrumb. It now uses **Journey / Opportunity updates**.

## Shared continuity verified

The regression check projects a representative verified opportunity through Journey, Application details, and Calendar. It asserts that title, organization, opportunity ID, and official deadline stay canonical. Official dates remain distinct from editable personal dates.

## Intentional differences preserved

- Discover remains wider and denser than For You, Opportunity Detail, Notifications, and Profile.
- For You keeps recommendation-specific fit signals that disappear after an opportunity enters Journey.
- Journey uses compact workflow rows; Opportunity Detail keeps a readable editorial layout.
- “Open official application,” “View official offer,” and “View official source” remain distinct because they describe different provider actions.
- Application and Calendar retain specialized controls instead of being forced into one generic card or dialog abstraction.

## Legacy patterns reviewed

Current authenticated surfaces already use the shared loading, action-feedback, Undo, empty-state, organization-branding, and same-origin request systems. No replacement architecture was added. Internal identifiers such as `applicationWorkspace` and existing analytics event names remain for compatibility.

## Current validation source

The current implementation evidence, viewport coverage, workflow counts, and qualitative surface scores are maintained in [Product Cohesion and UX](./PRODUCT_COHESION_AND_UX.md). Build and bundle numbers are reported from each release run rather than preserved here as stale snapshots.

## Remaining issues

- Native popover behavior depends on current Chromium and WebKit support; browser suites remain the regression guard.
- Some older public catalog subsections use legacy editorial link labels. They are outside the authenticated Discover → Journey workflow and should be handled as a separate content-template cleanup.
- Browser Back/Forward state is session-scoped by design; a new browser session intentionally starts from canonical defaults.

## Not implemented

No new dashboard, assistant, social surface, recommendation system, navigation destination, or workflow was added. Existing internal Command Center and Packet projections remain implementation details rather than separate student-facing products.
