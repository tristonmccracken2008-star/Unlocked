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

Scholarships use the same Opportunity model with award, renewal, and application metadata. Follow the [scholarship maintenance guide](./docs/SCHOLARSHIPS_GUIDE.md) before adding awards or deadlines.

## Category and editorial pages

Category pages are generated from the `categories` array at `/categories/[slug]`. Editorial SEO pages live in the `app` directory:

- `/best-edu-email-perks`
- `/student-discounts`
- `/free-student-software`
- `/student-ai-tools`

## Community submissions

The submit-opportunity form prepares a message to `support@unlockededu.com`. The student reviews and sends the message from their email app; the website never claims an unsent submission was received.

## Deploy to Vercel

1. Push the project directory to a Git repository.
2. Import the repository in Vercel.
3. If this project remains in a larger repository, set the Vercel root directory to this application directory.
4. Keep the default Next.js build command (`npm run build`) and output settings.
5. Point `www.unlockededu.com` to the production deployment and redirect the apex domain to it.

Production authentication, account sync, and aggregate analytics use the environment variables documented in `docs/AUTHENTICATION.md`. Set `ADMIN_EMAILS` to a comma-separated administrator allowlist for `/admin/analytics`. Vercel Analytics and Speed Insights are mounted in the root layout and should be enabled for the Vercel project.
