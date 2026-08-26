# Product Cohesion and UX

## Audit before implementation

UnlockED's underlying state ownership is sound, but the interface exposes too much of that architecture. The primary header currently gives Planner the same weight as Discover, For You, and Journey, while the Journey menu also contains Applications, Materials, Resume Lab, Accomplishments, Insights, history, and sharing. Learn then describes every subsystem as a separate product. The result is technically accurate and cognitively expensive.

| Surface | Primary job | Primary action | Audit finding |
| --- | --- | --- | --- |
| Discover | Search the complete catalog | Open an opportunity | Explore, Collections, and Paths are related entry modes but appear as separate concepts without a visible parent model. |
| For You | Review a small eligibility-gated shortlist | Open the best match | The page is distinct and valuable; it should remain prominent. |
| Journey | Manage opportunities being pursued | Update the most relevant item | Its navigation menu has become a directory for unrelated build and history tools. |
| Planner / Calendar | Understand upcoming dates | Review the next dated item | Planner and Calendar are complementary views, not separate top-level domains. |
| Applications | See what needs work across active applications | Open one application | The overview is clear, but extra cross-links and “Packet” / “Command Center” language expose implementation concepts. |
| Application detail | Prepare one application | Complete the next known action | This is the one canonical application-detail experience. “Packet” remains an internal projection name only. |
| Materials | Keep reusable asset records | Add a material record | The no-file-storage boundary is correct but reads like missing functionality instead of a clear product boundary. |
| Resume Lab | Build and tailor resumes from confirmed experience | Work on the current resume step | First use presents resume creation and evidence collection as competing actions. |
| Accomplishments / Insights | Review completed outcomes and factual history | Review the relevant history | Both belong to history and should not compete in primary navigation. |
| Learn | Explain the product only when needed | Follow one workflow stage | The current page reads as a manual for more than fifteen product nouns. |
| Universal Search | Find an opportunity or destination quickly | Open the selected result | Search is a useful escape hatch, but some results repeat internal Packet terminology. |

### Main overlap decisions

- **Applications** is the cross-application overview. **Application details** is the only user-facing name for one application's preparation view. Existing Packet and Command Center modules remain internal and keep their data contracts.
- **Planner** and **Calendar** live under Journey. Planner looks ahead; Calendar holds specific dates.
- **Resume Lab** and **Materials** live under Build. Resume Lab creates resume content; Materials records reusable assets and their application associations.
- **Accomplishments** and **Insights** live under History, reached contextually from Journey, Build, Profile, Learn, and Universal Search.
- **Explore**, **Collections**, and **Paths** are modes within Discover. They remain separate routes because each has a useful browsing model, but they no longer compete as top-level products.

## Simplified information architecture

The persistent navigation has four stable destinations:

1. **Discover** — Search, Explore, Collections, and Paths.
2. **For You** — A small personalized shortlist and its preferences.
3. **Journey** — Active opportunities, Applications, Planner, and Calendar.
4. **Build** — Resume Lab and Materials.

History and help are secondary account/context destinations. They remain searchable and linked from the places where they are useful, but they do not occupy primary navigation.

The student-facing flow is:

`Find -> Add to Journey -> Prepare application -> Build or select materials -> Track dates -> Record outcome -> Reuse experience`

## Responsibilities

- Discover owns catalog navigation, not intent.
- For You owns recommendation presentation, not application status.
- Journey owns pursuit status.
- Applications owns the overview of application work but stores no lifecycle state.
- Application details composes the existing application sources for one opportunity.
- Planner and Calendar project time without creating duplicate dates.
- Resume Lab owns resume evidence and composition.
- Materials owns reusable asset records and associations, not files.
- Accomplishments owns editable successful-outcome records.
- Insights is read-only history.

## User-facing terminology

Use these nouns: **Opportunity, Watch, Journey, Application, Material, Resume, Accomplishment, Insight**.

Do not expose **projection, state machine, Command Center, Application Packet, intelligence layer**, or store names in normal product UI. Internal code, analytics event names, and technical documentation may retain stable legacy identifiers.

## Action language

- **Open Opportunity** — open the UnlockED detail page.
- **View official source / Open official application** — leave UnlockED for the provider.
- **Watch** — monitor without pursuing.
- **Add to Journey** — begin tracking an opportunity in Saved.
- **Open application** — enter the single-application detail view.
- **Mark as applied** — record that the student submitted externally.
- **Add material** — create a metadata record; it never implies file upload.
- **Create master resume / Create targeted version** — create Resume Lab documents.

## Page design rules

- One page heading and one dominant action.
- At most two secondary actions in the first viewport.
- Rows and separators for dense work; cards only for self-contained objects.
- Details, history, and explanation use progressive disclosure.
- Empty states offer one useful next step and at most one secondary escape.
- Existing content stays visible during background refreshes.
- Status color supports text; it never carries meaning alone.
- Copy is short, factual, and calm. Avoid motivational, corporate, and internal-system language.

## Context preservation

Application details may hand off to Resume Lab with a target application and a safe return destination. Materials links return to the relevant application detail, not an overview anchor. Server ownership, authentication, same-origin protections, version checks, and idempotency remain unchanged.

## Quality rubric

Major surfaces are reviewed internally on a 1–5 scale for clarity, visual quality, ease of use, information density, action clarity, cohesion, and performance. Launch target is at least 4 in every category. The score is an audit tool and is never shown to students.

## Measured workflow changes

These counts describe navigation steps, not server calls. They were checked with the existing seeded browser personas.

| Workflow | Before | After |
| --- | --- | --- |
| Discover to opportunity detail | One click | One click; unchanged because it was already direct. |
| Add an opportunity to Journey | One action | One action; unchanged and still uses the canonical Journey mutation. |
| Applications to one application | One click, followed by Packet / Command Center terminology | One click into **Application details**. |
| Application detail to Resume Lab and back | Context was lost on the return path | Two navigation actions with the target application and safe return path preserved. |
| Materials to the related application | Materials to Applications overview, then into the application | One direct link to the related application. |
| Learn to a core workflow | Scan a directory of more than fifteen feature names | Choose one of five stages, then one primary destination. |

## Post-implementation audit

Scores are internal qualitative review results, not user-research metrics. Each score is the average of the rubric dimensions above.

| Surface | Before | After | Result |
| --- | ---: | ---: | --- |
| Discover | 4.5 | 4.5 | Kept stable; the successful catalog experience was not redesigned. |
| For You | 4.5 | 4.5 | Kept stable; recommendation behavior and presentation were preserved. |
| Journey | 4.0 | 4.3 | Its related planning and application destinations now have one clear parent. |
| Applications | 3.5 | 4.5 | One purpose, one row action, and no redundant hero navigation. |
| Application details | 3.5 | 4.5 | Internal projection language is gone and the next action is specific. |
| Resume Lab | 3.5 | 4.3 | First use has one dominant action and the application return path is retained. |
| Materials | 3.5 | 4.3 | The metadata-only boundary is explicit and related applications open directly. |
| Learn | 2.5 | 4.5 | A feature directory became a five-stage product workflow. |

## Validation evidence

- Desktop review: 1280, 1440, and 1728 pixel layouts across the existing product browser suites.
- Compact review: 390 and 640 pixel layouts, plus 200% reflow-equivalent coverage where supported by the suite.
- Chromium and WebKit coverage for Applications, application details, Resume Lab, Materials, Discover exploration, Discover collections, and Learn.
- Keyboard, reduced-motion, dark-theme, account-isolation, and long-content scenarios remain covered by their owning suites.
- Server state ownership, authentication, billing, recommendation scoring, catalog data, and persistence contracts were not changed.
