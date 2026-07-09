-- ─────────────────────────────────────────────────────────────────────────────
-- Kingdom Health Group — Sales Scoreboard — Supabase schema
--
-- Run this ONCE in your Supabase project:  Dashboard > SQL Editor > New query >
-- paste this > Run.
--
-- A team scoreboard is shared: everyone sees ONE board. So this is a single-row
-- table that holds the whole board as one JSON document. The anon (publishable)
-- key can read and write it, which is what makes the board live for the whole team.
--
-- Security note: this is intentionally simple for a small internal sales board.
-- The admin password only gates the APP's edit screens — at the database level,
-- anyone who has the site URL could technically write this row. That's an
-- accepted tradeoff: the data is low-stakes (deal counts, not PII), the app
-- sanitizes everything it reads from this row (see cleanBoard in app.js), and
-- the URL is only shared with the team. If you ever want hard server-side
-- protection (only admins can write), add Clerk/Supabase auth and tighten the
-- write policy.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.board_state (
  id         text primary key,           -- always 'shared-board'
  data       jsonb not null,             -- the entire scoreboard state blob
  updated_at timestamptz not null default now()
);

alter table public.board_state enable row level security;

-- Anyone with the anon key (i.e. anyone who opens the site) can read the board...
drop policy if exists "team can read board" on public.board_state;
create policy "team can read board" on public.board_state
  for select to anon using (true);

-- ...and write it. Edits are gated behind the admin password inside the app.
drop policy if exists "team can write board" on public.board_state;
create policy "team can write board" on public.board_state
  for all to anon using (true) with check (true);

-- Live updates: publish row changes so every open phone re-renders the moment
-- an admin saves. (Wrapped so re-running this script doesn't error.)
do $$
begin
  alter publication supabase_realtime add table public.board_state;
exception
  when duplicate_object then null;
end $$;
