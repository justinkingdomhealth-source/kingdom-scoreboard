// ─────────────────────────────────────────────────────────────────────────────
// Kingdom Health Group — Sales Scoreboard — cloud bootstrap.
//
// This is the ONLY thing that changed about how the board loads. All scoreboard
// logic lives untouched in app.js and talks to storage exactly as before, through
// localStorage key "khg_v13".
//
// Unlike a personal app, a team scoreboard is SHARED: everyone should see the same
// board. So instead of a per-user row, we keep ONE shared row in Supabase that the
// whole team reads, and that admins push to when they update scores.
//
// What this does, in order:
//   1. No Supabase keys configured -> just load the app (local-only, like before).
//   2. Keys configured             -> pull the shared board into localStorage, THEN
//                                     load the app, THEN mirror every save() back up.
//
// app.js never has to know about any of this. We hand it data the same way it
// already expects, and we expose window.cloudSync so the "Publish to Team" button
// can force an immediate push.
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  "use strict";

  var KEY = "khg_v13";
  var ROW_ID = "shared-board";        // single shared row — the whole team reads this
  var TABLE = "board_state";
  var APP_VERSION = "2026-07-13.1";   // bump when app.js changes to force a fresh load
  var CFG = window.APP_CONFIG || {};
  var hasSupabase = !!(CFG.SUPABASE_URL && CFG.SUPABASE_URL.trim() &&
                       CFG.SUPABASE_ANON_KEY && CFG.SUPABASE_ANON_KEY.trim());

  var sb = null; // Supabase client once loaded

  // expose a tiny sync handle the app can call (see publishToTeam in app.js)
  window.cloudSync = { enabled: false, push: function () { return Promise.resolve(); } };

  // ── tiny helpers ────────────────────────────────────────────────────────────
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src; s.async = true; s.crossOrigin = "anonymous";
      s.onload = resolve;
      s.onerror = function () { reject(new Error("Failed to load " + src)); };
      document.head.appendChild(s);
    });
  }

  function overlay(innerHtml) {
    var el = document.getElementById("__bootCover");
    if (!el) {
      el = document.createElement("div");
      el.id = "__bootCover";
      el.style.cssText =
        "position:fixed;inset:0;z-index:100000;display:flex;align-items:center;" +
        "justify-content:center;background:#070b16;color:#fff;font-family:'Segoe UI'," +
        "system-ui,-apple-system,sans-serif;";
      document.body.appendChild(el);
    }
    el.innerHTML =
      '<div style="text-align:center;max-width:420px;padding:24px">' + innerHtml + "</div>";
    return el;
  }
  function removeOverlay() { var el = document.getElementById("__bootCover"); if (el) el.remove(); }
  function spinnerHtml(msg) {
    return (
      '<div style="font-size:26px;font-weight:900;letter-spacing:-.02em;margin-bottom:6px;' +
      'background:linear-gradient(135deg,#c9a020,#f7e98e,#d4af37);-webkit-background-clip:text;' +
      '-webkit-text-fill-color:transparent;background-clip:text">Kingdom Health Group</div>' +
      '<div style="color:#9ca3af;font-size:14px">' + (msg || "Loading…") + "</div>"
    );
  }

  // ── load the actual app once we're cleared ──────────────────────────────────
  var appLoaded = false;
  function loadApp() {
    if (appLoaded) return Promise.resolve();
    appLoaded = true;
    removeOverlay();
    return loadScript("app.js?v=" + APP_VERSION);
  }

  // ── cloud sync (Supabase, shared row) ───────────────────────────────────────
  var pushTimer = null;
  var pushPending = false; // a save happened and hasn't reached the cloud yet

  function pushNow(data) {
    clearTimeout(pushTimer);
    pushPending = false;
    if (!sb) return Promise.resolve();
    var blob = data;
    if (!blob) {
      var raw = localStorage.getItem(KEY);
      if (!raw) return Promise.resolve();
      try { blob = JSON.parse(raw); } catch (e) { return Promise.resolve(); }
    }
    return sb.from(TABLE)
      .upsert({ id: ROW_ID, data: blob, updated_at: new Date().toISOString() })
      .then(function (res) {
        if (res && res.error) console.warn("[cloud] save failed:", res.error.message);
      });
  }

  function debouncedPush() {
    clearTimeout(pushTimer);
    pushPending = true;
    pushTimer = setTimeout(function () { pushNow(); }, 800);
  }

  function wrapSaveForCloud() {
    window.cloudSync = { enabled: true, push: function (data) { return pushNow(data); } };
    if (typeof window.save === "function") {
      var origSave = window.save;
      window.save = function () {
        var r = origSave.apply(this, arguments);
        debouncedPush();
        return r;
      };
    }
  }

  // ── live updates ────────────────────────────────────────────────────────────
  // Two channels keep every open phone current without anyone refreshing:
  //   1. Supabase Realtime — the database pushes the new board to every open tab
  //      the moment an admin saves. Instant.
  //   2. Visibility refetch — when someone returns to the tab (e.g. flips back
  //      from GroupMe), we re-pull the latest board. Covers phones that were
  //      backgrounded and missed the push.
  function applyIncoming(data) {
    if (data && typeof window.applyCloudData === "function") window.applyCloudData(data);
  }

  function refetchLatest() {
    if (!sb) return;
    sb.from(TABLE).select("data").eq("id", ROW_ID).maybeSingle().then(function (res) {
      if (res && res.data && res.data.data) applyIncoming(res.data.data);
    });
  }

  function startLiveUpdates() {
    try {
      sb.channel("board-live")
        .on("postgres_changes",
          { event: "*", schema: "public", table: TABLE, filter: "id=eq." + ROW_ID },
          function (payload) {
            var row = payload["new"];
            // Oversized rows arrive with fields stripped (payload.errors set) —
            // fall back to fetching the full row instead of dropping the event.
            if (row && row.data) applyIncoming(row.data);
            else refetchLatest();
          })
        .subscribe();
    } catch (e) {
      console.warn("[cloud] realtime unavailable, falling back to refetch-on-focus:", e.message);
    }
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") {
        // If a local save never made it up (phones suspend timers in the
        // background), finish OUR push first — refetching now would pull the
        // old board down over the newer local edits and then broadcast it.
        if (pushPending) pushNow();
        else refetchLatest();
      } else if (pushPending) {
        pushNow(); // heading to background: flush before timers get suspended
      }
    });
  }

  async function pullThenLoadApp() {
    try {
      var res = await sb.from(TABLE).select("data").eq("id", ROW_ID).maybeSingle();
      if (res && res.data && res.data.data) {
        localStorage.setItem(KEY, JSON.stringify(res.data.data));
      }
    } catch (e) {
      console.warn("[cloud] load failed, using local copy:", e.message);
    }
    await loadApp();
    wrapSaveForCloud();
    startLiveUpdates();
  }

  async function initSupabase() {
    await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js");
    sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
  }

  // ── orchestration ───────────────────────────────────────────────────────────
  async function boot() {
    if (!hasSupabase) { await loadApp(); return; } // local-only, identical to the original
    overlay(spinnerHtml("Loading the team board…"));
    try {
      await initSupabase();
      await pullThenLoadApp();
    } catch (err) {
      console.error("[cloud] bootstrap error:", err);
      // Never block the board on a cloud hiccup — fall back to local.
      await loadApp();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
