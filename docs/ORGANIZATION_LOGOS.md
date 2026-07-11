# Organization Logo System

UnlockED uses a centralized organization logo resolver so opportunity cards stay recognizable without scattering image URLs across the product.

## Source Order

`resolveOrganizationLogo(opportunity)` resolves identity in this order:

1. Curated organization registry in `data/organization-logos.ts`
2. Trusted source-provided HTTPS logo URL, only when it matches the official source host or an approved logo host
3. Domain-based logo provider using the verified registry domain or official source domain
4. Generated initials fallback
5. Category fallback when no organization name is available

The resolver never infers logos from arbitrary opportunity title text. Organization matching is based on the structured `organization` field, approved aliases, and official source domains.

## Registry Policy

Add a registry entry when an organization appears often, has a common alias, or needs a clearer brand identity than the source-domain fallback can provide.

Each registry entry should include:

- `displayName`
- `aliases`
- `domain`
- `logoVerified`

Use official organization domains whenever possible. Avoid third-party image URLs unless they are intentionally approved in `approvedLogoHosts`.

## Trust Rules

Logos are visual identifiers only. They do not imply endorsement, partnership, sponsorship, or administration by the organization.

If an image fails to load, `<OrganizationLogo />` falls back to initials or category text without leaving a blank card.

## Checks

Run:

```bash
npm run check:logos
npm run audit:logos
```

`check:logos` is a build-blocking regression check. `audit:logos` is a content-quality report for unresolved organizations, duplicates, malformed source URLs, and invalid curated assets.
