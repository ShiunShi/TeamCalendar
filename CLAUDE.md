# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

**TeamCalendar V2** — freshly scaffolded with `create-next-app` (Next.js 16, React 19, TypeScript 5, Tailwind v4, ESLint 9, Turbopack). Project root is this `src/` directory; `app/` lives at the root (no nested `src/app`). No feature code, shadcn/ui, Firebase wiring, or tests yet — the architecture below is the intended design and is still to be built out.

A predecessor project lives at `/mnt/d/work/TeamCalendar/` — consult it for prior decisions, but do not assume V2 inherits its structure unless explicitly carried over.

## System Architecture

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

### Architectural implications to keep in mind

- **Next.js App Router** — favor Server Components by default; reach for `"use client"` only when interactivity (state, effects, browser APIs) is required. Route handlers live under `app/api/*/route.ts`.
- **Firestore is the only data store** — there is no separate server DB or ORM. Data access happens either directly from client components (via the Firebase Web SDK with security rules enforcing access) or from server code via the Admin SDK. Decide per-feature which path is appropriate and stay consistent within a feature.
- **Auth spans two providers in one Firebase Auth project** — Google SSO and email/password. Account-linking and "user already exists with different provider" flows need explicit handling.
- **Hosted on Vercel, scheduled jobs on Firebase** — Vercel runs the Next.js app; recurring/background work (notably the retention sweep) runs as Cloud Functions for Firebase, *not* Vercel Cron. Don't add Vercel cron jobs without checking whether the work belongs in a Cloud Function instead.
- **shadcn/ui is copy-in, not a dependency** — components live in the repo (typically `components/ui/`) and are edited directly. Prefer adding/customizing shadcn components over introducing a competing UI library.
- **Use `sonner` for all toasts and `lucide-react` for all icons** — don't mix in other toast/icon libraries.

## Commands

```bash
npm run dev      # next dev (Turbopack) — http://localhost:3000
npm run build    # production build
npm run start    # serve the production build
npm run lint     # eslint (flat config at eslint.config.mjs)
npx tsc --noEmit # typecheck (no `typecheck` script yet — add one when convenient)
```

No test runner configured yet. When adding one (Vitest is the common pairing with Next 16 + React 19), document the single-test invocation here.

No Firebase tooling installed yet. When `firebase-tools` lands, document emulator (`firebase emulators:start`) and deploy commands.
