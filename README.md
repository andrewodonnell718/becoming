# Becoming

A mobile-first personal growth operating system.

> I am not trying to become a different person overnight. I am building evidence every day that I am becoming the person I said I would be.

**Loop:** Vision → 90-day direction → weekly plan → daily action → evidence → reflection → adjustment → growth.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173 (also on your Wi-Fi IP for your phone)
npm test           # calculation tests
npm run build      # production build in dist/
```

The app works fully offline with no setup. Data is saved on the device.

## Sections

| Tab | What's there |
|---|---|
| Today | Primary outcome, most important task, scheduled items, commitments and practices, morning check-in, evening review, "I'm stuck" |
| Plan | Direction (vision, constitution, 7 pillars / pursuit / 8 masteries, life areas), 90-day outcomes (max 3), weekly plan |
| Track | Daily scorecard (28-day history), measurements, pattern log |
| Reflect | Journal history, weekly review, pattern insights |
| Grow | Evidence counts, weekly trend, recurring patterns, outcomes achieved |

All calculations are in `src/lib/evidence.ts` and tested in `src/lib/evidence.test.ts`.

## Sync across devices and the AI coach (optional, free tier)

1. Create a project at supabase.com.
2. SQL Editor → run `supabase/schema.sql`.
3. Authentication → Email templates → "Magic Link": include `{{ .Token }}` so the email carries a 6-digit code. Codes work inside the installed phone app; links would open Safari instead.
4. Copy `.env.example` to `.env` and fill in the Project URL and anon key (Project Settings → API).
5. AI coach: install the Supabase CLI, then
   ```bash
   supabase link --project-ref <your-ref>
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   supabase functions deploy coach
   ```
   The coach uses Claude Opus 5 with server-side refusal fallbacks. Only signed-in users can call it. Each coach request is a paid Anthropic API call, and it only runs when you tap a coach button.

## Reminders

Set the times under the account button (top right) → Reminders. The defaults are morning 7:00, evening 20:30, and weekly review Sunday 18:00. Reminders skip anything you've already done.

- **In-app (no setup):** when you open the app, Today shows what's due. After your evening time the "Close the day" card is highlighted, and from your weekly review time until the end of the week a "Weekly review" card appears.
- **Phone notifications (needs Supabase):** on iPhone they only work for the app added to the Home Screen (iOS 16.4+).
  1. `npx web-push generate-vapid-keys`
  2. Put the **public** key in `.env` as `VITE_VAPID_PUBLIC_KEY`.
  3. `supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com CRON_SECRET=<any long random string>`
  4. `supabase functions deploy remind --no-verify-jwt`
  5. Edit the placeholders in `supabase/cron.sql` and run it in the SQL Editor. It checks every 15 minutes, and each reminder is sent at most once, within an hour of its time.
  6. In the installed app: account button → Reminders → **Turn on phone notifications**. Tapping a notification opens the check-in or review directly.

## Put it on your phone (free)

Deploy `dist/` to Vercel, Netlify or Cloudflare Pages (connect the repo; build command `npm run build`, output `dist`, and add the `VITE_SUPABASE_*` and `VITE_VAPID_PUBLIC_KEY` env vars). Open the URL in Safari → Share → **Add to Home Screen**.

## Fonts

`public/fonts` holds the Fontspring **demo** cut of All Round Gothic. The demo draws some characters (4 % / - ' ( ) etc.) as a watermark, so `src/styles/global.css` restricts it to the clean characters with `unicode-range`, and numbers use Montserrat. With the licensed files: replace the woff2 files, delete the `unicode-range` lines, and set `--font-num: var(--font-head)`.

## Background video

`public/bg.mp4` is your city timelapse, re-encoded to 1280×854 at 1.6 Mbps with no audio (3.3 MB). It's cached after first play. It's hidden when the device has Reduce Motion turned on.
