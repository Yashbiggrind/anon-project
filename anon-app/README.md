# ANON// — Frontend

Next.js frontend for the ANON anonymous chat app.

## Live
https://anon-project-tau.vercel.app

## Stack
- Next.js 16 (App Router, Turbopack)
- React 19
- TypeScript
- Socket.io client
- IndexedDB (local message history)

## Environment Variables
Create `.env.local`:

NEXT_PUBLIC_SERVER_URL=http://localhost:4000

For production, set this to your deployed backend URL.

## Run locally
npm install
npm run dev
Open http://localhost:3000

## Build
npm run build

## Deploy
Deployed on Vercel. Auto-deploys on every push to main.

## Key files
- app/page.tsx          — main chat UI (public, private, content)
- app/anon.css          — all styles
- app/data/page.tsx     — footprint log
- app/legal/[page]/     — privacy, terms, rules, grievance, transparency
- lib/anonConstants.tsx — emojis, translations, doors config
- lib/i18n.ts           — language strings (EN/HI/AR/ES/FR/ZH)
- lib/messageStore.ts   — IndexedDB message persistence
- lib/footprint.ts      — decaying footprint logic
