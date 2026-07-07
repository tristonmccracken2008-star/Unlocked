# UnlockED

UnlockED is a static Next.js directory for verified student benefits, discounts, free software, AI tools, campus resources, and other offers available through student status.

## Run locally

Requirements: Node.js 20.9 or newer and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use `npm run build` to run the production build and TypeScript checks.

## Manage catalog data

Every content item is stored in the unified [`opportunities.json`](./data/db/opportunities.json) catalog. Schools remain normalized separately, and typed compatibility views keep existing benefit, AI, career, school, and SEO pages working.

See the [Opportunity Engine guide](./docs/OPPORTUNITY_ENGINE.md) and [data administration guide](./docs/DATA_ADMIN_GUIDE.md) for exact maintenance steps. Universal opportunity detail pages and existing compatibility pages are generated automatically.

All benefit records use a four-state verification lifecycle and an internal review score. Follow the [benefit verification guide](./docs/VERIFICATION_GUIDE.md) before publishing or changing a benefit’s status.

AI tools and benefits share the Opportunity model. Follow the [AI tools catalog guide](./docs/AI_TOOLS_GUIDE.md) before changing a tool or student-access claim.

Career opportunities have their own verified catalog and ranking rules. Follow the [opportunity catalog guide](./docs/OPPORTUNITIES_GUIDE.md) before adding programs or deadlines.

Undergraduate research uses the same Opportunity model with research-specific metadata. Follow the [research maintenance guide](./docs/RESEARCH_GUIDE.md) before adding labs, programs, or stipends.

## Category and editorial pages

Category pages are generated from the `categories` array at `/categories/[slug]`. Editorial SEO pages live in the `app` directory:

- `/best-edu-email-perks`
- `/student-discounts`
- `/free-student-software`
- `/student-ai-tools`

## Local submissions

The submit-perk form stores records in browser `localStorage` under `unlocked-submissions` and logs each successful submission to the browser console. No data is sent to a server.

## Deploy to Vercel

1. Push the project directory to a Git repository.
2. Import the repository in Vercel.
3. If this project remains in a larger repository, set the Vercel root directory to this application directory.
4. Keep the default Next.js build command (`npm run build`) and output settings.
5. Point the production domain to the deployment. If the domain is not `unlocked.education`, update `metadataBase` in `app/layout.tsx` and `base` in `app/sitemap.ts`.

The project requires no environment variables, database, authentication provider, or paid API.
