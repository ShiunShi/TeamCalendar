# TeamCalendar V2

Shared team calendar for PTO, travel, birthdays, and more.

## What this is

A Next.js App Router application backed by Firestore and Firebase Auth, hosted on Vercel. v1.0 runs in a single shared workspace; teams are sub-units inside that workspace, and any member of any team can author events on the shared calendar.

For architecture and design decisions, see [`CLAUDE.md`](./CLAUDE.md).

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React + Next.js (App Router) |
| Database | Google Firestore |
| Auth | Google SSO + email/password (Firebase Auth) |
| Hosting | Vercel |
| Styling | Tailwind CSS, shadcn/ui |
| Toasts | sonner |
| Icons | lucide-react |
| Scheduled jobs | Cloud Functions for Firebase (retention sweep) |

## Prerequisites

- Node 20+ (Next.js 16 requirement)
- A Firebase project with **Firestore (Native mode)** and **Authentication** enabled — both **Google** and **Email/Password** sign-in providers turned on
- Optional: [`firebase-tools`](https://firebase.google.com/docs/cli) for deploying Firestore rules (not yet wired into this repo)

## Getting started

```bash
git clone <repo-url>
cd src
npm install
cp .env.local.example .env.local
# Fill in values from Firebase Console → Project Settings → General → "Your apps"
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be redirected to `/signin`.

The client variables (`NEXT_PUBLIC_FIREBASE_*` + `NEXT_PUBLIC_WORKSPACE_ID`) are sufficient to run `npm run dev`. The server-only `FIREBASE_*` variables in [`.env.local.example`](./.env.local.example) are only needed once Cloud Functions land (Phase 9).

## Scripts

| Script | What it does |
|--------|--------------|
| `npm run dev` | Next.js dev server (Turbopack) on :3000 |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint (flat config at `eslint.config.mjs`) |
| `npx tsc --noEmit` | Typecheck (no script yet — see `CLAUDE.md`) |

## Project structure

```
app/                  Next.js App Router routes
  (auth)/             sign-in flow
  join/[token]/       invite-link join page
components/           UI (shadcn/ui under components/ui/)
lib/
  auth/               AuthProvider + useUser hook
  db/                 Firestore data-access helpers
  firebase/           client.ts + admin.ts (server-only)
firestore.rules       Security rules (deploy via firebase-tools)
```

## Deployment

- **App** — Vercel. Push to `main`.
- **Firestore rules** — `firebase deploy --only firestore:rules` once `firebase-tools` is set up locally, or paste [`firestore.rules`](./firestore.rules) into Firebase Console → Firestore → Rules.
- **Scheduled jobs / Cloud Functions** — not yet wired up; planned for Phase 9.

## See also

- [`CLAUDE.md`](./CLAUDE.md) — architecture and conventions for AI/dev work in this repo
- [`AGENTS.md`](./AGENTS.md) — Next.js 16 breaking-changes notice
- [`firestore.rules`](./firestore.rules) — security model
- [`.env.local.example`](./.env.local.example) — environment variable contract
