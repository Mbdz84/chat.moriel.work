# Chat Console

WhatsApp-style SMS console. Multi-tenant: each user logs in (company code + username + password) and works their own Twilio number. Contact list on the left, chat pane on the right.

**Current state:** UI only, running on mock data. Backend (Twilio + Supabase auth/storage + push) is not wired yet.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 — the login screen. Any values sign you in (mock auth) and take you to `/chat`.

## Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** for styling
- Deploys to **Vercel** as-is

## Structure

```
app/
  page.tsx        Login screen (company / username / password)
  chat/page.tsx   Main chat UI (contact list + chat pane + composer)
  layout.tsx      Root layout
  globals.css     Tailwind + chat wallpaper / scrollbars
lib/
  mockData.ts     Fake contacts & messages (shapes mirror the future DB tables)
  format.ts       Time / date / initials helpers
```

## Deploy: GitHub → Vercel

1. Create a new GitHub repo and push this folder to it:
   ```bash
   git init
   git add .
   git commit -m "Initial chat UI"
   git branch -M main
   git remote add origin https://github.com/<you>/chat-website.git
   git push -u origin main
   ```
2. Go to vercel.com → **New Project** → import the repo. Framework auto-detects as Next.js. Click **Deploy**.
3. From then on, **every `git push` to `main` auto-deploys to production**; other branches/PRs get preview URLs.

## Next steps (backend wiring — not built yet)

1. **Supabase** — auth (company/user/pass), tables: `users`, `contacts`, `messages`. Realtime pushes new messages to the open chat.
2. **Twilio incoming** — API route `app/api/twilio/webhook/route.ts` receives inbound SMS → writes a `message` row. Set this URL as the number's webhook in Twilio.
3. **Twilio outgoing** — API route `app/api/send/route.ts` → Twilio API, using the logged-in user's number. Wire the composer's `send()` to it.
4. **Push notifications** — PWA (manifest + service worker) with Web Push. Works on Android in-browser; on iPhone works once "Add to Home Screen".

Secrets (`TWILIO_*`, `SUPABASE_*`) go in Vercel env vars, never in the repo.
