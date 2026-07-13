// ─────────────────────────────────────────────────────────────────────────────
// api/deals.js — Kingdom Scoreboard PRIVATE deals ledger (keeps client PII off the
// public board). Talks to the locked `deals` table with the Supabase SERVICE key
// (server-only env var). Reads are gated behind the admin password.
//
// POST JSON with { action }:
//   'log'    { secret, agentId, agentName, agentEmoji, product, client, carrier, effective, premium }
//   'unlog'  { secret, id }            -> delete a just-logged deal (rep undo)
//   'list'   { pw, agent? }            -> ADMIN: verifies pw against the board's admin password
//   'delete' { pw, id }               -> ADMIN: remove a deal
// GET -> health check.
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = "https://hkddwywcctifpfhryzwf.supabase.co";
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY || "";
const LOG_SECRET   = "kh-deal-70087b73"; // also embedded in app.js; a speed bump, not real auth

function sb(path, opts) {
  opts = opts || {};
  return fetch(SUPABASE_URL + "/rest/v1/" + path, {
    method: opts.method || "GET",
    headers: Object.assign({
      apikey: SERVICE_KEY,
      Authorization: "Bearer " + SERVICE_KEY,
      "Content-Type": "application/json"
    }, opts.headers || {}),
    body: opts.body
  });
}

async function adminOk(pw) {
  if (!pw) return false;
  const r = await sb("board_state?id=eq.shared-board&select=data");
  if (!r.ok) return false;
  const rows = await r.json();
  const real = rows && rows[0] && rows[0].data && rows[0].data.pw;
  return !!real && String(pw) === String(real);
}

module.exports = async (req, res) => {
  try {
    if (!SERVICE_KEY) return res.status(200).json({ ok: false, error: "backend not configured (set SUPABASE_SERVICE_KEY)" });
    if (req.method !== "POST") return res.status(200).json({ ok: true, msg: "deals api ready" });

    const b = (req.body && typeof req.body === "object") ? req.body : {};

    if (b.action === "log") {
      if (b.secret !== LOG_SECRET) return res.status(200).json({ ok: false, error: "bad secret" });
      const row = {
        agent_id:    String(b.agentId || "").slice(0, 60),
        agent_name:  String(b.agentName || "").slice(0, 80),
        agent_emoji: String(b.agentEmoji || "").slice(0, 16),
        product:     ["ancillary", "life", "medicare"].includes(b.product) ? b.product : "other",
        client:      String(b.client || "").slice(0, 120),
        carrier:     String(b.carrier || "").slice(0, 80),
        effective:   (b.effective && /^\d{4}-\d{2}-\d{2}$/.test(b.effective)) ? b.effective : null,
        premium:     Math.max(0, Number(b.premium) || 0)
      };
      const r = await sb("deals", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(row) });
      if (!r.ok) { const t = await r.text(); return res.status(200).json({ ok: false, error: "insert failed", detail: t.slice(0, 200) }); }
      const ins = await r.json();
      return res.status(200).json({ ok: true, id: ins && ins[0] && ins[0].id });
    }

    if (b.action === "unlog") {
      if (b.secret !== LOG_SECRET) return res.status(200).json({ ok: false, error: "bad secret" });
      const id = parseInt(b.id, 10);
      if (!id) return res.status(200).json({ ok: false, error: "bad id" });
      const r = await sb("deals?id=eq." + id, { method: "DELETE" });
      return res.status(200).json({ ok: r.ok });
    }

    if (b.action === "list") {
      if (!(await adminOk(b.pw))) return res.status(200).json({ ok: false, error: "unauthorized" });
      let q = "deals?select=*&order=created_at.desc&limit=1000";
      if (b.agent) q += "&agent_id=eq." + encodeURIComponent(b.agent);
      const r = await sb(q);
      if (!r.ok) return res.status(200).json({ ok: false, error: "read failed" });
      return res.status(200).json({ ok: true, deals: await r.json() });
    }

    if (b.action === "delete") {
      if (!(await adminOk(b.pw))) return res.status(200).json({ ok: false, error: "unauthorized" });
      const id = parseInt(b.id, 10);
      if (!id) return res.status(200).json({ ok: false, error: "bad id" });
      const r = await sb("deals?id=eq." + id, { method: "DELETE" });
      return res.status(200).json({ ok: r.ok });
    }

    return res.status(200).json({ ok: false, error: "unknown action" });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String((e && e.message) || e) });
  }
};
