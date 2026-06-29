# PinBoard Junior

Capture an idea the moment you have it — image, sketch, quote, paragraph, link —
keep it private by default, and choose what to share. Private → shared → circle →
public, one gesture along the way.

See [`instructions.md`](./instructions.md) for the full spec.

## Status

Phase 0 — Foundations (pre-build). This is a minimal Next.js skeleton so the repo
deploys; the data model and authorization layer come next.

## Stack

Next.js (App Router) · TypeScript · Supabase (Postgres + auth + storage) · Vercel.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy

Import the repo into Vercel — the framework preset auto-detects as **Next.js**.
Add Supabase credentials as environment variables (or via the Vercel–Supabase
integration) when the data layer lands. Never commit `.env` files.
