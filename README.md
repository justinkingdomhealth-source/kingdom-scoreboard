# Kingdom Health Group — Sales Scoreboard

A live, gamified sales leaderboard for the team: divisions with promotion/relegation,
per-product leaderboards (Medicare / Ancillary / Life), all-time running totals,
month close-out with champions + history, and a "Paste from GroupMe" importer.

Built as a **buildless static site** (no Node build step) — just `index.html`,
`app.js`, and a tiny cloud bootstrap. Deployed on Vercel.

## Files

| File | What it is |
|------|------------|
| `index.html` | The page shell (markup + styles). Loads `config.js`, then `lib/cloud.js`. |
| `app.js` | All scoreboard logic, extracted verbatim. Storage = localStorage key `khg_v12`. |
| `config.js` | **Public** Supabase keys. Empty = local-only mode. |
| `lib/cloud.js` | Boot logic: if keys are set, pull the shared board from Supabase, load the app, then mirror saves back up. |
| `supabase/schema.sql` | One `board_state` table (single shared row) — run once in Supabase. |
| `vercel.json` | Clean URLs + basic security headers. |

## Two modes

- **Local-only (default).** With `config.js` blank, the board runs exactly like the
  original single file: data is saved per-browser. Anyone who opens the URL sees the
  seeded standings; your edits stay on your device.
- **Shared cloud (recommended for a team board).** Fill in `config.js` with a free
  Supabase project's URL + anon key so the whole team sees ONE live board, and the
  "📢 Publish to Team" button pushes your updates to everyone.

### Turn on shared cloud sync (~3 min)

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query →** paste `supabase/schema.sql` → **Run**.
3. **Settings → API:** copy `Project URL` and the `anon public` key.
4. Paste both into `config.js`, commit, and redeploy.

Admin actions (paste scores, manage team, close month, change password) are gated
behind the in-app **admin password** (default `king1` — change it under ⚙️ Manage Team).

## Redeploy

Deployment is done via the Vercel REST API (file upload, not git integration), so
a `git push` alone does **not** update the live site. Re-run the deploy script /
API upload after pushing. Tokens live in `.env` (gitignored, never shipped).
