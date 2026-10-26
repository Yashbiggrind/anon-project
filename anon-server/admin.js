// admin.js — v21.4 ANON admin dashboard
// Routes: GET /admin?token=XXX | GET /api/admin/* | POST /api/admin/reports/:id/review
// v21.4 — adds session log export (Rule 3(1)(i))

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ANON// admin</title>
<style>
  :root{--red:#e11d48;--red-hi:#ff2d55;--ink:#020104;--text:#e8dde2;--dim:#8a7276;--line:#24080f;}
  *{box-sizing:border-box}
  body{margin:0;background:#020104;color:#e8dde2;font-family:'Courier New',monospace;font-size:13px;padding:20px}
  h1{margin:0 0 20px;font-family:'Times New Roman',serif;font-size:26px;font-weight:900;letter-spacing:-.5px}
  h1 i{color:#ff2d55;font-style:normal}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px}
  .stat{background:linear-gradient(180deg,#0c0407,#060103);border:1px solid #24080f;border-radius:8px;padding:14px}
  .stat .n{font-size:24px;font-weight:900;color:#ff2d55;font-family:'Times New Roman',serif}
  .stat .l{font-size:9px;letter-spacing:2px;color:#7c5a63;text-transform:uppercase;margin-top:4px}
  .bar{display:flex;gap:8px;margin-bottom:14px}
  .bar button{background:#160409;border:1px solid #2a0a12;color:#c9a3ad;padding:8px 14px;border-radius:6px;cursor:pointer;font-family:inherit;font-size:11px;letter-spacing:1.4px;text-transform:uppercase}
  .bar button.active{background:#2a0710;border-color:#ff2d55;color:#ff5875}
  .bar button:hover{border-color:#7a0a1c;color:#fff}
  table{width:100%;border-collapse:collapse;background:#0c0407;border:1px solid #24080f;border-radius:8px;overflow:hidden}
  th{text-align:left;padding:10px 12px;font-size:10px;letter-spacing:2px;color:#7c5a63;text-transform:uppercase;border-bottom:1px solid #24080f;background:#0a0205}
  td{padding:10px 12px;border-bottom:1px solid #1a060c;vertical-align:top;font-size:12px;color:#d8c9c9}
  tr:last-child td{border-bottom:0}
  tr.reviewed{opacity:.55}
  .tag{display:inline-block;padding:2px 8px;border-radius:4px;font-size:9px;letter-spacing:1.4px;text-transform:uppercase;font-weight:700}
  .tag.new{background:rgba(255,45,85,.15);border:1px solid #7a0a1c;color:#ff5875}
  .tag.done{background:rgba(53,210,124,.12);border:1px solid #143a24;color:#7dffa8}
  .act{background:#160409;border:1px solid #2a0a12;color:#c9a3ad;padding:5px 10px;border-radius:5px;cursor:pointer;font-family:inherit;font-size:10px;letter-spacing:1.2px;text-transform:uppercase;margin-right:4px}
  .act:hover{border-color:#7a0a1c;color:#fff}
  .act.primary{background:#3a0510;border-color:#7a0a1c;color:#ff5875}
  .act.primary:hover{background:#5a0818;color:#fff}
  .dim{color:#7c5a63;font-size:11px}
  .empty{text-align:center;padding:40px;color:#5a4048;font-style:italic}
  .footer{margin-top:20px;font-size:10px;color:#5a4048;text-align:center}
  .login{max-width:460px;margin:40px auto;padding:22px;background:#0c0407;border:1px solid #3a0a14;border-radius:10px}
  .login p{color:#8a7276;line-height:1.5}
  .login input{width:100%;padding:11px;background:#050204;color:#f4e8e8;border:1px solid #3a0a14;border-radius:6px;font:inherit;margin:8px 0 12px}
  .login button{padding:10px 14px;background:#3a0510;color:#fff;border:1px solid #7a0a1c;border-radius:6px;font:inherit;cursor:pointer}
  #loginError{color:#ff7890;min-height:18px;margin-top:8px}
</style>
</head>
<body>
  <h1>ANON<i>//</i> ADMIN</h1>
  <section id="loginGate" class="login">
    <h2>Administrator sign-in</h2>
    <p>Enter the server-side admin token. It will remain in this page's memory only and will not be placed in the URL or saved in browser storage.</p>
    <form id="loginForm" autocomplete="off">
      <label for="adminToken">Admin token</label>
      <input id="adminToken" type="password" autocomplete="current-password" required minlength="32" />
      <button type="submit">Sign in</button>
      <div id="loginError" role="status" aria-live="polite"></div>
    </form>
  </section>
  <div id="adminContent" style="display:none">
  <div id="stats" class="grid"></div>
  <div class="bar">
    <button data-f="unreviewed" class="active">Unreviewed</button>
    <button data-f="all">All</button>
    <button id="refresh">⟳ Refresh</button>
    <button id="openExport" style="margin-left:auto;">⇩ Export Sessions</button>
  </div>

  <div id="exportPanel" style="display:none;margin-bottom:14px;padding:14px;background:#0c0407;border:1px solid #24080f;border-radius:8px;">
    <div style="font-size:11px;letter-spacing:2px;color:#7c5a63;text-transform:uppercase;margin-bottom:10px;">Session Log Export — Rule 3(1)(i)</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;">
      <label style="display:flex;flex-direction:column;gap:4px;font-size:11px;color:#c9a3ad;">
        FROM
        <input id="exFrom" type="datetime-local" style="background:#0a0205;border:1px solid #2a0a12;color:#f4e8e8;padding:6px 8px;border-radius:5px;font-family:inherit;" />
      </label>
      <label style="display:flex;flex-direction:column;gap:4px;font-size:11px;color:#c9a3ad;">
        TO
        <input id="exTo" type="datetime-local" style="background:#0a0205;border:1px solid #2a0a12;color:#f4e8e8;padding:6px 8px;border-radius:5px;font-family:inherit;" />
      </label>
      <label style="display:flex;flex-direction:column;gap:4px;font-size:11px;color:#c9a3ad;flex:1;min-width:200px;">
        IP HASH (optional)
        <input id="exIp" type="text" placeholder="32-char hash, leave blank for all" style="background:#0a0205;border:1px solid #2a0a12;color:#f4e8e8;padding:6px 8px;border-radius:5px;font-family:inherit;" />
      </label>
      <button id="exJson" class="act primary">Download JSON</button>
      <button id="exCsv" class="act">Download CSV</button>
      <button id="exClose" class="act">Close</button>
    </div>
    <div id="exResult" style="margin-top:10px;font-size:11px;color:#7c5a63;"></div>
  </div>

  <div id="reports"></div>
  <div class="footer">auto-refresh every 30s · <span id="lastUpdate"></span></div>
  </div>

<script>
let TOKEN = "";
let refreshTimer = null;
let filter = "unreviewed";

async function apiFetch(url, options = {}) {
  if (!TOKEN) throw new Error("Sign in required.");
  return fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), "x-admin-token": TOKEN },
    cache: "no-store",
  });
}

document.getElementById("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const field = document.getElementById("adminToken");
  const error = document.getElementById("loginError");
  TOKEN = field.value.trim();
  error.textContent = "Checking token…";
  try {
    const response = await apiFetch("/api/admin/stats");
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error("Invalid token or access denied.");
    document.getElementById("loginGate").style.display = "none";
    document.getElementById("adminContent").style.display = "block";
    field.value = "";
    error.textContent = "";
    await Promise.all([loadStats(), loadReports()]);
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(() => {
      if (TOKEN) { loadReports(); loadStats(); }
    }, 30000);
  } catch (err) {
    TOKEN = "";
    error.textContent = err instanceof Error ? err.message : "Authentication failed.";
  }
});

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function ago(ts) {
  const d = Math.floor((Date.now() - ts) / 1000);
  if (d < 60) return d + "s ago";
  if (d < 3600) return Math.floor(d/60) + "m ago";
  if (d < 86400) return Math.floor(d/3600) + "h ago";
  return Math.floor(d/86400) + "d ago";
}

async function loadStats() {
  const r = await apiFetch("/api/admin/stats");
  const j = await r.json();
  if (!j.ok) return;
  const s = j.stats || {};
  const live = j.live || {};
  document.getElementById("stats").innerHTML = \`
    <div class="stat"><div class="n">\${s.unreviewed || 0}</div><div class="l">Unreviewed</div></div>
    <div class="stat"><div class="n">\${s.reports || 0}</div><div class="l">Total Reports</div></div>
    <div class="stat"><div class="n">\${s.strikes || 0}</div><div class="l">Strikes on Record</div></div>
    <div class="stat"><div class="n">\${s.sessions || 0}</div><div class="l">Sessions Logged</div></div>
    <div class="stat"><div class="n">\${live.sessions || 0}</div><div class="l">Live Sessions</div></div>
    <div class="stat"><div class="n">\${live.rooms || 0}</div><div class="l">Live Rooms</div></div>
  \`;
}

async function loadReports() {
  const q = filter === "unreviewed" ? "?unreviewed=1" : "";
  const r = await apiFetch("/api/admin/reports" + q);
  const j = await r.json();
  if (!j.ok) return;
  const list = j.reports || [];
  const el = document.getElementById("reports");
  if (!list.length) {
    el.innerHTML = '<div class="empty">No reports to review. Quiet out there.</div>';
  } else {
    el.innerHTML = \`<table><thead><tr>
      <th>When</th><th>Reporter</th><th>Target</th><th>Reason</th><th>Status</th><th></th>
    </tr></thead><tbody>\` + list.map(r => \`
      <tr class="\${r.reviewed ? "reviewed" : ""}">
        <td class="dim">\${ago(r.createdAt)}</td>
        <td>\${esc(r.reporter.slice(0,10))}…</td>
        <td>\${esc(r.targetUsername || r.target.slice(0,10))}</td>
        <td>\${esc(r.reason)}</td>
        <td>\${r.reviewed ? '<span class="tag done">reviewed</span>' : '<span class="tag new">new</span>'}</td>
        <td>
          \${!r.reviewed ? \`
            <button class="act primary" data-id="\${r.id}" data-action="dismiss">Dismiss</button>
            <button class="act" data-id="\${r.id}" data-action="warned">Warn</button>
            <button class="act" data-id="\${r.id}" data-action="shadow-banned">Shadow-ban</button>
          \` : \`<span class="dim">\${esc(r.actionTaken || "—")}</span>\`}
        </td>
      </tr>
    \`).join("") + "</tbody></table>";
  }
  document.getElementById("lastUpdate").textContent = "updated " + new Date().toLocaleTimeString();
}

async function act(id, action) {
  if (!confirm("Mark this report as: " + action + "?")) return;
  await apiFetch("/api/admin/reports/" + encodeURIComponent(id) + "/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  loadReports();
  loadStats();
}

document.addEventListener("click", (e) => {
  const t = e.target;
  if (t.matches(".bar button[data-f]")) {
    filter = t.dataset.f;
    document.querySelectorAll(".bar button[data-f]").forEach(b => b.classList.toggle("active", b === t));
    loadReports();
  } else if (t.id === "refresh") {
    loadReports(); loadStats();
  } else if (t.matches(".act[data-id]")) {
    act(t.dataset.id, t.dataset.action);
  }
});

// ---- v21.4 export panel ----
const panel = document.getElementById("exportPanel");
const exFrom = document.getElementById("exFrom");
const exTo = document.getElementById("exTo");
const exIp = document.getElementById("exIp");
const exResult = document.getElementById("exResult");

document.getElementById("openExport").addEventListener("click", () => {
  panel.style.display = panel.style.display === "none" ? "block" : "none";
});
document.getElementById("exClose").addEventListener("click", () => {
  panel.style.display = "none";
});

function toMs(input) {
  if (!input.value) return null;
  const t = new Date(input.value).getTime();
  return Number.isFinite(t) ? t : null;
}

function buildQuery() {
  const q = new URLSearchParams();
  const since = toMs(exFrom);
  const until = toMs(exTo);
  if (since) q.set("since", String(since));
  if (until) q.set("until", String(until));
  if (exIp.value.trim()) q.set("ip", exIp.value.trim());
  return q;
}

document.getElementById("exJson").addEventListener("click", async () => {
  exResult.textContent = "Loading…";
  try {
    const q = buildQuery();
    const r = await apiFetch("/api/admin/sessions?" + q.toString());
    const j = await r.json();
    if (!j.ok) { exResult.textContent = "Error: " + (j.error || "unknown"); return; }
    const blob = new Blob([JSON.stringify(j.sessions, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "anon-sessions-" + Date.now() + ".json";
    a.click();
    URL.revokeObjectURL(url);
    exResult.textContent = j.count + " session(s) exported as JSON.";
  } catch (e) {
    exResult.textContent = "Failed: " + e.message;
  }
});

document.getElementById("exCsv").addEventListener("click", async () => {
  exResult.textContent = "Downloading CSV…";
  try {
    const response = await apiFetch("/api/admin/sessions.csv?" + buildQuery().toString());
    if (!response.ok) throw new Error("Export failed (HTTP " + response.status + ").");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "anon-sessions-" + Date.now() + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    exResult.textContent = "CSV download started.";
  } catch (err) {
    exResult.textContent = err instanceof Error ? err.message : "Export failed.";
  }
});

// Data loads only after a successful sign-in; the token is never read from the URL.

</script>
</body>
</html>`;
}

function registerAdmin({ app, db, sessions, strikeRecords, rooms, ADMIN_TOKEN }) {
  function checkToken(req, res, next) {
    if (!ADMIN_TOKEN) return res.status(500).json({ ok: false, error: "ADMIN_TOKEN not set on server" });
    const authorization = String(req.headers.authorization || "");
    const bearer = authorization.match(/^Bearer\s+(.+)$/i);
    const token = req.headers["x-admin-token"] || (bearer ? bearer[1] : "");
    if (!token || token !== ADMIN_TOKEN) return res.status(401).json({ ok: false, error: "Unauthorized" });
    next();
  }

  app.get("/admin", (req, res) => {
    if (!ADMIN_TOKEN) return res.status(500).send("ADMIN_TOKEN not configured. Set it in .env and restart.");
    res.setHeader("Cache-Control", "no-store");
    res.type("html").send(renderPage());
  });

  app.get("/api/admin/stats", checkToken, (_req, res) => {
    res.json({
      ok: true,
      stats: db.getStats() || {},
      live: { sessions: sessions.size, rooms: rooms.size, strikes: strikeRecords.size },
    });
  });

  app.get("/api/admin/reports", checkToken, (req, res) => {
    const onlyUnreviewed = req.query.unreviewed === "1";
    const limit = Math.min(500, parseInt(req.query.limit, 10) || 100);
    res.json({ ok: true, reports: db.listReports(limit, onlyUnreviewed) });
  });

  app.post("/api/admin/reports/:id/review", checkToken, (req, res) => {
    const id = String(req.params.id || "");
    const action = String(req.body?.action || "").slice(0, 100);
    if (!id) return res.status(400).json({ ok: false, error: "Missing id" });
    db.markReportReviewed(id, action);
    res.json({ ok: true });
  });

  // v21.4 — session log export (Rule 3(1)(i) — lawful order response)
  app.get("/api/admin/sessions", checkToken, (req, res) => {
    const since = parseInt(req.query.since, 10) || 0;
    const until = parseInt(req.query.until, 10) || Date.now();
    const ipHash = req.query.ip ? String(req.query.ip).slice(0, 64) : null;
    const limit = Math.min(5000, parseInt(req.query.limit, 10) || 1000);

    const rows = db.listSessions({ since, until, ipHash, limit });
    console.log(`[admin] session export: ${rows.length} rows (since=${since}, until=${until}, ip=${ipHash || "*"})`);
    res.json({ ok: true, count: rows.length, sessions: rows });
  });

  app.get("/api/admin/sessions.csv", checkToken, (req, res) => {
    const since = parseInt(req.query.since, 10) || 0;
    const until = parseInt(req.query.until, 10) || Date.now();
    const ipHash = req.query.ip ? String(req.query.ip).slice(0, 64) : null;
    const limit = Math.min(5000, parseInt(req.query.limit, 10) || 1000);

    const rows = db.listSessions({ since, until, ipHash, limit });

    const header = "id,ip_hash,session_id,connected_at_iso,connected_at_ms,disconnected_at_iso,disconnected_at_ms,user_agent\n";
    const body = rows.map((r) => {
      const conn = new Date(r.connectedAt).toISOString();
      const disc = r.disconnectedAt ? new Date(r.disconnectedAt).toISOString() : "";
      const ua = String(r.userAgent || "").replace(/"/g, '""');
      return [
        r.id,
        r.ipHash,
        r.sessionId,
        conn,
        r.connectedAt,
        disc,
        r.disconnectedAt || "",
        `"${ua}"`,
      ].join(",");
    }).join("\n");

    console.log(`[admin] CSV session export: ${rows.length} rows`);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="anon-sessions-${Date.now()}.csv"`);
    res.send(header + body);
  });

  console.log(`[admin] dashboard registered at /admin (token ${ADMIN_TOKEN ? "set" : "MISSING"})`);
  console.log(`[admin] export routes: /api/admin/sessions + /api/admin/sessions.csv`);
}

module.exports = { registerAdmin };