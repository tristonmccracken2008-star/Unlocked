# Journey Cards 2.0

Journey Cards turn confirmed Journey progress into privacy-controlled PNGs. The creator remains a lazy client boundary; the Journey page and its status model are unchanged.

## Data flow

1. `buildJourneyTimelineModel()` derives bounded `JourneyCardAchievement` records from accepted, completed, research, internship, and scholarship events.
2. Every achievement declares its compatible templates. The UI cannot select a template that would misstate the source event.
3. The creator applies transient format, theme, and privacy choices to one deterministic SVG.
4. `serializeBrandedArtwork()` embeds only same-origin logo assets before the SVG is drawn to a fixed-size canvas.
5. Download, clipboard, and Web Share actions receive the same PNG used by the live preview.

The annual summary is generated only from non-zero Journey statistics. No sample achievement is inserted into the gallery.

## Templates and formats

Templates: Acceptance, Internship, Scholarship, Research, Offer, Completion, and Year in Review.

Themes: Cream, Forest, Midnight, and Ivory & Gold.

Formats:

- Story: 1080 x 1920
- Square: 1080 x 1080
- LinkedIn: 1200 x 627

Each format has independent composition measurements. Long text is deterministically wrapped and bounded.

## Privacy

The preview is the export contract. Students can hide their name, school, date, role, organization, location, award amount, and UnlockED branding when those fields exist. Email, GPA, profile answers, application notes, and internal account data never enter `JourneyCardData`.

Organization marks are limited to curated same-origin assets. External logo URLs fall back to initials and are never fetched during export.

## Performance and accessibility

The creator and PNG libraries load only after intent. Card geometry is static and does not use browser measurement. The native dialog provides focus containment and Escape handling; closing restores focus to the trigger. Controls meet the 44-pixel target, expose pressed or checked state, retain chronological source facts, and support reduced motion, forced colors, keyboard use, and a screen-reader equivalent of the SVG.

Run:

```bash
npm run check:journey-cards
npm run check:journey-visual
npm run check:journey-accessibility
npm run test:journey-v1-browser
```
