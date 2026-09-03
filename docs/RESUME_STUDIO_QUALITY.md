# Resume Studio Quality

## Truthfulness contract

The Studio must never invent a number, skill, outcome, title, responsibility, comparison, or selection claim. Drafting reads only confirmed facts. Numeric claims must appear in linked evidence or be explicitly confirmed. Language such as “led,” “managed,” “first,” “best,” or “top” is flagged when linked evidence does not support the implied responsibility or comparison. Missing outcomes prompt the student to add one only if known.

Target comparison is descriptive: “represented,” “not represented,” and “available elsewhere in Experience Bank.” It never reports a match percentage, quality score, or likelihood of success.

## Review model

Findings retain their category and severity:

- Content: identity, dates, sections, and missing descriptions.
- Evidence: unsupported quantities, authority, comparisons, or missing known outcomes.
- Clarity: vague openings, inflated language, and hard-to-scan bullets.
- Consistency: tense, pronouns, repeated openings, and punctuation.
- Layout: estimated page overflow and line pressure.
- Target alignment: explicit opportunity language compared with supported resume content.

The next action is deterministic and prioritizes missing identity, hidden education, evidence fixes, missing bullets, page overflow, target review, and then remaining findings. A clean audit leads to print preview—not a claim that the resume is objectively perfect.

## Layout rules

Readable typography and useful content take priority over forcing one page. The estimator counts visible sections, entries, and approximate wrapped lines. When content likely exceeds one page, guidance first recommends removing weak or low-relevance content and tightening wording. Templates must not shrink text below their documented print sizes merely to fit.

## Accessibility and responsive behavior

All major controls use native labels, fieldsets, buttons, links, selects, and details/summary. Edit, Review, Tailor, and Preview are keyboard-operable tabs. Section ordering has labeled up/down buttons as a keyboard alternative to drag-and-drop. Feedback uses a polite live region and errors use alert semantics. Mobile collapses two-column layouts, preserves 44px actions, and prevents horizontal application overflow; the letter-sized print canvas may scroll on small screens by design.

## Verification matrix

- Unit/contract: evidence-only drafting, alternative generation, claim extraction, unsupported-claim detection, context prompts, categorical review, layout estimation, target comparison, normalization bounds, version conflicts, idempotency, private-session exclusion, and Materials integration.
- Performance: 1,200 evidence-backed bullets audit below the existing 50ms average budget on the test fixture.
- Browser: signed-out redirect, creation flow, Experience Bank fact capture, Studio mode switching, resume inclusion, save, print/PDF route, desktop/mobile overflow, reduced motion, dark theme, WebKit, and account isolation.
- Release: TypeScript, Resume Lab checks, Build/Application/Materials/search integration checks, browser suite, production build, and clean committed worktree.

## Deferred quality gates

Binary imports require private storage, malware scanning, format and size validation, extraction provenance, review-before-save, retention/deletion policy, and fixtures for malformed documents. DOCX export requires render comparisons across Word-compatible engines. Neither is represented as complete today.
