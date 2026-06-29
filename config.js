// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC CONFIG — these values are safe to expose in the browser.
//
// Leave them BLANK to run in local-only mode: the board works exactly like the
// original file, but each browser keeps its own copy (teammates who open the URL
// see the seeded standings, not your live edits).
//
// Fill them in to turn on SHARED cloud sync so the whole team sees one live board:
//   1. Create a free project at supabase.com
//   2. Run supabase/schema.sql once   (Dashboard > SQL Editor > New query > Run)
//   3. Settings > API:
//        SUPABASE_URL      = "Project URL"
//        SUPABASE_ANON_KEY = "anon public" key
//   4. Paste them below, commit, and redeploy. Done.
// ─────────────────────────────────────────────────────────────────────────────
window.APP_CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: ""
};
