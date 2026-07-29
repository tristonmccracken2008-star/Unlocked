# UnlockED brand assets

UnlockED uses the uploaded raster logo as its single graphical source of truth.

## Canonical files

- `public/brand/unlocked-logo-source.png` is the byte-for-byte uploaded source.
  Do not edit or optimize this file.
- `public/brand/unlocked-mark.png` is the transparent, tightly cropped,
  high-density web asset used by the product.
- `app/icon.png` and `app/apple-icon.png` are technical app-icon derivatives.

Run `npm run prepare:brand` after intentionally replacing the source. The
preparation script removes only the baked background, preserves the original
colors and proportions, and regenerates the transparent mark and app icons.

`data/brand-assets.ts` owns the runtime asset path and intrinsic dimensions.
`components/brand-mark.tsx` is the only product renderer. Generated Journey
Cards, Path Moments, and Semester Stories use the same component and inline the
canonical PNG only at export time through `lib/brand-export.ts`.

## Usage

- Use `Logo` when the UnlockED wordmark belongs beside the mark.
- Use `BrandMark` for compact graphical placements.
- Use `BrandMarkArtwork` inside exportable SVG artwork.
- Do not recolor, redraw, crop, stretch, or recreate the mark with SVG paths.
- Preserve clear space around the mark and use `object-fit: contain`.

Notification email remains text-only by design. Its existing security regression
test prohibits remote images so email branding cannot become a tracking request.
No legacy graphical logo is used in the email template.
