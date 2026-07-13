-- ─────────────────────────────────────────────────────────────────────────────
-- Kingdom Scoreboard — PRIVATE deals ledger.
--
-- Client PII (names) must NEVER live on the public board row (anyone with the site
-- URL can read that). So detailed deals go in this separate table, locked so the
-- public anon key can neither read nor write it. Only the server-side service_role
-- key — held by api/deals.js as a Vercel env var — can touch it, and that function
-- only returns the list after checking the admin password.
--
-- Run this ONCE:  Supabase Dashboard > SQL Editor > New query > paste > Run.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.deals (
  id          bigint generated always as identity primary key,
  agent_id    text,
  agent_name  text,
  agent_emoji text,
  product     text,                        -- 'ancillary' | 'life' | 'medicare'
  client      text,                        -- client name (PII — never exposed to anon)
  carrier     text,
  effective   date,
  premium     numeric not null default 0,  -- ANNUAL premium $
  created_at  timestamptz not null default now()
);

-- RLS on with NO anon policies => the anon (publishable) key is fully blocked from
-- reading or writing. The service_role key bypasses RLS, so only api/deals.js can.
alter table public.deals enable row level security;
revoke all on public.deals from anon;
