# Moshko — Hours & Costs Tracker

Mobile-first admin app for logging worker hours, client rates, addons (car, parking), and monthly per-client cost reports.

**Hebrew-first** UI with English toggle · **Convex** database · **WorkOS** Google invite-only auth · **Cloudflare Pages** hosting.

## Quick start

1. Copy env file:

```bash
cp .env.example .env.local
```

2. Create a [Convex](https://convex.dev) project and paste the deployment URL into `VITE_CONVEX_URL`.

```bash
npx convex dev
```

Set Convex dashboard env var: `WORKOS_CLIENT_ID` (same as WorkOS client id).

3. Create a [WorkOS](https://workos.com) app:
   - AuthKit / User Management
   - Enable **Google** only
   - Redirect URI: `http://localhost:5173/auth/callback` (and your Pages URL later)
   - Put client id in `VITE_WORKOS_CLIENT_ID`

4. Run the app:

```bash
npm install
npm run dev
```

First Google sign-in becomes the first admin. Later admins must be invited from **Settings**.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite + hot reload |
| `npm run ci` | typecheck + lint + test + build |
| `npm test` | Vitest (cost + CSV) |
| `npx convex dev` | Convex backend sync |

## Deploy

- **GitHub**: push `main` — Actions runs CI
- **Cloudflare Pages**: connect the repo, build `npm run build`, output `dist`, set `VITE_CONVEX_URL` + `VITE_WORKOS_CLIENT_ID` (+ redirect URI for Pages domain)

## Phase 2 (not built yet)

- Overtime band thresholds (100–200%)
- Email monthly reports to clients
- Domain mail forward for client replies

## CSV template

Download from the Import screen, or use `public/templates/entries-template.csv`.
