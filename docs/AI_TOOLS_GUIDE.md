# AI tools catalog maintenance

AI tools are stored in `data/db/ai-tools.json` and loaded through `data/ai-tools.ts`. This catalog is independent from the benefits database: a tool can be useful to students without having a student-specific discount.

## Required fields

Every record requires:

- `slug`, `name`, and `company`
- factual `description`
- `studentOffer` stating exactly what is verified
- `eligibility`
- HTTPS `officialSourceUrl`
- ISO `lastVerifiedAt` date
- normalized `category`
- `offerType`
- `verificationStatus`
- `estimatedAnnualValue`, using `null` when no defensible value exists

## Offer types

- `free_for_everyone`: an official provider page confirms a generally available free plan. Do not describe this as a student discount.
- `student_discount`: the provider publishes student pricing or a student promotion.
- `free_with_edu`: the provider confirms free access after student or education verification.
- `university_specific`: an official university source confirms access for that institution. This type needs a future school relationship before personalization.
- `no_verified_student_offer`: the tool is legitimate, but no current student offer was confirmed.

## Verification rules

1. Use only the provider’s official pricing, education, help, or product page.
2. Confirm that the exact offer language is present; a free trial is not a free plan.
3. Do not infer student access from a company’s education branding.
4. Mark uncertain, redirected, region-limited, or unclear offers `needs_review` and use conservative wording.
5. Never calculate an estimated value unless official current prices support the calculation. Otherwise use `null`.
6. Update `lastVerifiedAt` only after checking the source and all material claims.
7. Run `npm run validate:data` and `npm run build` before publishing.

The dashboard deliberately shows “Unknown” for unpriced value and “Needs Review” when a student claim is not sufficiently supported.
