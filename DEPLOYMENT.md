# Deploy UnlockED to Vercel

UnlockED is a static-first Next.js application. It requires Node.js 20.9 or newer and currently has no environment variables, database, authentication service, or paid API dependency.

## 1. Verify the project locally

From the application directory:

```bash
cd /Users/tristonmccracken/Documents/Project/eduperks
npm install
npm run build
```

Commit both `package.json` and `package-lock.json`. Vercel will use the lockfile to install the same dependency versions.

## 2. Create the Git repository

The project is not currently connected to Git. Initialize it from the application directory so this folder becomes the repository root:

```bash
cd /Users/tristonmccracken/Documents/Project/eduperks
git init
git add .
git commit -m "Prepare UnlockED for deployment"
git branch -M main
```

Before `git add .`, confirm `.gitignore` includes `.next`, `node_modules`, local environment files, and Vercel’s local `.vercel` directory.

## 3. Publish to GitHub

1. Sign in to [GitHub](https://github.com).
2. Select **New repository**.
3. Name it `unlocked` and choose the desired visibility.
4. Do not initialize it with a README, license, or `.gitignore`; those files already exist locally.
5. Create the repository.
6. Copy the repository URL and run:

```bash
git remote add origin https://github.com/YOUR-USERNAME/unlocked.git
git push -u origin main
```

Confirm the connection with:

```bash
git remote -v
git status
```

`git status` should report a clean working tree, and `origin` should show the GitHub URL for fetch and push.

## 4. Import the project into Vercel

1. Sign in to [Vercel](https://vercel.com) using the GitHub account that owns the repository.
2. Select **Add New → Project**.
3. Import the `unlocked` repository.
4. Keep **Framework Preset** set to **Next.js**.
5. Keep the root directory as `./` because the repository was initialized inside the application directory.
6. Keep the default install command (`npm install`) and build command (`npm run build`).
7. Do not add environment variables; none are currently required.
8. Select **Deploy**.
9. After deployment, open the generated Vercel URL and test the homepage search, a school page, a benefit page, a category page, and the submit-perk form.

Every push to `main` will create a new production deployment. Pull requests and non-production branches will receive preview deployments.

## 5. Configure the production domain

The application currently uses `https://unlocked.education` as its canonical URL. If that is the intended domain:

1. Open the Vercel project’s **Settings → Domains**.
2. Add `unlocked.education` and optionally `www.unlocked.education`.
3. Apply the DNS records shown by Vercel at the domain registrar.
4. Choose one hostname as canonical and redirect the other to it.

If a different domain will be used, update all three locations before launch:

- `metadataBase` and Open Graph URL in `app/layout.tsx`
- `base` in `app/sitemap.ts`
- the sitemap URL in `app/robots.ts`

Run `npm run build`, commit those changes, and push again.

## 6. Post-deployment checks

- Confirm `/robots.txt` points to the production sitemap.
- Confirm `/sitemap.xml` uses the production domain.
- View the page source and verify canonical URLs and UnlockED metadata.
- Check school search aliases such as `UChicago` and `umich.edu`.
- Open official source links and report-outdated-information links.
- Test narrow mobile and desktop layouts.
- Confirm unknown-value benefits are excluded from savings totals.

The submit-perk form currently stores data only in the visitor’s browser. Deploying to Vercel does not create a shared submissions database.
