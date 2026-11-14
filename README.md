# MatchMetric

A football intelligence dashboard that combines live fixture data, a match centre and
its own prediction engine. Built with Next.js (App Router), React, TypeScript and
Firebase, with Sportmonks as the primary data provider.

## Features

- **Dashboard** — browse upcoming, live and completed fixtures by date and competition.
- **Match centre** — statistics, form, head-to-head, lineups and provider odds per fixture.
- **Manual Analysis** (`/manual-analysis`) — select up to five fixtures and generate
  MatchMetric's own model-based predictions, with evidence, confidence and data-quality
  reporting. Predictions are withheld when the underlying data is insufficient.
- **Saved picks** — authenticated users can store and review their analyses privately.

## Tech stack

- Next.js 15 (App Router) · React 19 · TypeScript
- Tailwind CSS v4
- Firebase Authentication, Cloud Firestore
- Sportmonks football API (server-side only)

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in your values. `.env.local` is
   git-ignored and must never be committed.

3. Run the development server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript checks |

## Environment variables

Web Firebase keys (`NEXT_PUBLIC_*`) are public identifiers. Server-side credentials
(Firebase Admin, Sportmonks, API-Football) are used only inside server routes and are
never exposed to the browser.

## Data and security notes

- All provider requests run through server-side `/api/football/*` and
  `/api/predictions/*` routes so API keys never reach the client.
- Fixture requests are limited to an eight-day window.
- Prediction generation and saved picks require authentication via a Firebase session
  cookie (`__session`).
- Firestore security rules restrict each user's data to that user.

Probabilities produced by the prediction engine are model estimates, not guarantees.
