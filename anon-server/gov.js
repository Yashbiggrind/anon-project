// gov.js — ANON// Republic: elections, vote cards, Sovereigns, Worlds, orgs, projects.
const crypto = require("crypto");
const FAST = process.env.GOV_FAST === "1";
const REG_MS = +process.env.GOV_REG_MS || (FAST ? 120e3 : 24 * 3600e3);
const VOTE_MS = +process.env.GOV_VOTE_MS || (FAST ? 180e3 : 24 * 3600e3);
const COOLDOWN_MS = +process.env.GOV_COOLDOWN_MS || (FAST ? 20e3 : 48 * 3600e3);
const TERM_MS = +process.env.GOV_TERM_MS || 14 * 24 * 3600e3;
const ONE_VOTE_PER_IP = process.env.GOV_ONE_VOTE_PER_IP === "1";
const SECRET = process.env.IP_HASH_SECRET || "change-me-in-env";
const KINDS = ["party", "cult", "team", "startup", "guild", "lab"];
const STAGES = {
  party: ["forming", "campaigning", "ruling", "opposition"],
  cult: ["whispers", "rising", "devoted", "ascended"],
  team: ["assembling", "active", "elite"],
  startup: ["idea", "prototype", "launched", "scaling"],
  guild: ["open", "established", "legendary"],
  lab: ["research", "building", "shipped"],
};

let db, io;
const id = () => crypto.randomBytes(6).toString("hex");
const now = () => Date.now();
const clean = (v, n) => String(v ?? "").replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, n);
const color = (c) => (/^#[0-9a-f]{6}$/i.test(c || "") ? c : "#22d3ee");
const fail = (m) => { const e = new Error(m); e.user = true; throw e; };
const sockets = new Map(); // citizenId -> Set(socket)

function init(_db, _io) {
  db = _db.getDb(); io = _io;
  if (!db) { console.error("[gov] db not ready"); return false; }
  db.exec(`
  CREATE TABLE IF NOT EXISTS citizens(id TEXT PRIMARY KEY, username TEXT, created_at INTEGER, last_seen INTEGER);
  CREATE TABLE IF NOT EXISTS elections(id TEXT PRIMARY KEY, world_id TEXT, office TEXT, phase TEXT, start_at INTEGER, reg_ends INTEGER, vote_ends INTEGER, created_at INTEGER, winner_cand TEXT, result TEXT, closed_at INTEGER);
  CREATE TABLE IF NOT EXISTS candidates(id TEXT PRIMARY KEY, election_id TEXT, citizen_id TEXT, party_id TEXT, slogan TEXT, manifesto TEXT, created_at INTEGER, UNIQUE(election_id,citizen_id));
  CREATE TABLE IF NOT EXISTS cards(election_id TEXT, citizen_id TEXT, ip_hash TEXT, issued_at INTEGER, voted INTEGER DEFAULT 0, PRIMARY KEY(election_id,citizen_id));
  CREATE TABLE IF NOT EXISTS ballots(serial TEXT PRIMARY KEY, election_id TEXT, choice TEXT) WITHOUT ROWID;
  CREATE TABLE IF NOT EXISTS charters(id TEXT PRIMARY KEY, citizen_id TEXT, election_id TEXT, issued_at INTEGER, expires_at INTEGER, world_id TEXT);
  CREATE TABLE IF NOT EXISTS worlds(id TEXT PRIMARY KEY, name TEXT, motto TEXT, color TEXT, owner_id TEXT, visibility TEXT, created_at INTEGER);
  CREATE TABLE IF NOT EXISTS world_members(world_id TEXT, citizen_id TEXT, role TEXT, title TEXT, joined_at INTEGER, PRIMARY KEY(world_id,citizen_id));
  CREATE TABLE IF NOT EXISTS orgs(id TEXT PRIMARY KEY, world_id TEXT, kind TEXT, name TEXT, tag TEXT, color TEXT, description TEXT, stage TEXT, visibility TEXT, founder_id TEXT, created_at INTEGER);
  CREATE TABLE IF NOT EXISTS org_members(org_id TEXT, citizen_id TEXT, role TEXT, status TEXT, joined_at INTEGER, PRIMARY KEY(org_id,citizen_id));
  CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY, org_id TEXT, title TEXT, description TEXT, status TEXT, created_by TEXT, created_at INTEGER);
  CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY, project_id TEXT, title TEXT, status TEXT, assignee_id TEXT, created_by TEXT, created_at INTEGER);
  CREATE TABLE IF NOT EXISTS feed(id TEXT PRIMARY KEY, scope TEXT, scope_id TEXT, kind TEXT, author_id TEXT, author_name TEXT, content TEXT, created_at INTEGER);
  CREATE INDEX IF NOT EXISTS idx_feed ON feed(scope,scope_id,created_at);
  `);
  ensureGlobal();
  setInterval(tick, 3000);
  console.log(`[gov] ready (reg ${REG_MS / 1000}s, vote ${VOTE_MS / 1000}s, cooldown ${COOLDOWN_MS / 1000}s)`);
  return true;
}

const q = (sql, ...a) => db.prepare(sql).all(...a);
const q1 = (sql, ...a) => db.prepare(sql).get(...a);
const run = (sql, ...a) => db.prepare(sql).run(...a);
const nameOf = (cid) => q1("SELECT username u FROM citizens WHERE id=?", cid)?.u || "unknown";
const dirty = (extra = {}) => io.to("gov").emit("gov:dirty", extra);
function tell(cid, msg) { for (const s of sockets.get(cid) || []) s.emit("gov:toast", msg); }

// ---------- election lifecycle ----------
function newElection(worldId, office, startAt, regMs, voteMs) {
  const eid = id(), t = startAt;
  run("INSERT INTO elections VALUES(?,?,?,?,?,?,?,?,NULL,NULL,NULL)", eid, worldId, office, t > now() ? "scheduled" : "registration", t, t + regMs, t + regMs + voteMs, now());
  return eid;
}
function ensureGlobal() {
  const open = q1("SELECT id FROM elections WHERE world_id IS NULL AND phase!='closed'");
  if (open) return;
  const last = q1("SELECT closed_at c FROM elections WHERE world_id IS NULL AND phase='closed' ORDER BY closed_at DESC");
  newElection(null, "Sovereign", last ? last.c + COOLDOWN_MS : now(), REG_MS, VOTE_MS);
  dirty();
}
function tick() {
  try {
    ensureGlobal();
    const t = now();
    for (const e of q("SELECT * FROM elections WHERE phase!='closed'")) {
      if (e.phase === "scheduled" && t >= e.start_at) { run("UPDATE elections SET phase='registration' WHERE id=?", e.id); dirty(); }
      else if (e.phase === "registration" && t >= e.reg_ends) advanceToVoting(e);
      else if (e.phase === "voting" && t >= e.vote_ends) closeElection(e);
    }
  } catch (err) { console.error("[gov] tick", err.message); }
}
function advanceToVoting(e) {
  if (!q1("SELECT 1 x FROM candidates WHERE election_id=?", e.id)) { // nobody stood: extend registration
    run("UPDATE elections SET reg_ends=?, vote_ends=vote_ends+? WHERE id=?", now() + 60e3 * (FAST ? 1 : 60), 60e3 * (FAST ? 1 : 60), e.id); return dirty();
  }
  run("UPDATE elections SET phase='voting' WHERE id=?", e.id); dirty();
}
function closeElection(e) {
  const cands = q("SELECT * FROM candidates WHERE election_id=? ORDER BY created_at", e.id);
  const tally = {}; cands.forEach((c) => (tally[c.id] = 0)); tally.NOTA = 0;
  for (const b of q("SELECT choice FROM ballots WHERE election_id=?", e.id)) if (b.choice in tally) tally[b.choice]++;
  const total = Object.values(tally).reduce((a, b) => a + b, 0);
  let best = null, tie = false;
  for (const c of cands) { if (!best || tally[c.id] > tally[best.id]) { best = c; tie = false; } else if (tally[c.id] === tally[best.id]) tie = true; }
  let winner = best && total > 0 && tally[best.id] > tally.NOTA ? best : null;
  const result = { tally, total, tiebreak: !!(winner && tie), noConfidence: !winner && total > 0 && tally.NOTA >= (best ? tally[best.id] : 0), voided: total === 0 };
  run("UPDATE elections SET phase='closed', winner_cand=?, result=?, closed_at=? WHERE id=?", winner?.id || null, JSON.stringify(result), now(), e.id);
  if (winner) {
    if (!e.world_id) {
      run("INSERT INTO charters VALUES(?,?,?,?,?,NULL)", id(), winner.citizen_id, e.id, now(), now() + TERM_MS);
      tell(winner.citizen_id, { type: "win", text: "You are the new SOVEREIGN. Found your World." });
    } else {
      run("UPDATE world_members SET title=? WHERE world_id=? AND citizen_id=? AND role!='sovereign'", e.office, e.world_id, winner.citizen_id);
      run("UPDATE world_members SET role='minister' WHERE world_id=? AND citizen_id=? AND role='citizen'", e.world_id, winner.citizen_id);
      run("INSERT INTO feed VALUES(?,?,?,?,?,?,?,?)", id(), "world", e.world_id, "decree", winner.citizen_id, nameOf(winner.citizen_id), `${nameOf(winner.citizen_id)} was elected ${e.office}.`, now());
    }
  }
  dirty();
}

// ---------- views ----------
function candView(c) {
  const p = c.party_id ? q1("SELECT id,name,tag,color FROM orgs WHERE id=?", c.party_id) : null;
  return { id: c.id, citizenId: c.citizen_id, name: nameOf(c.citizen_id), slogan: c.slogan, manifesto: c.manifesto, party: p || null };
}
function electionView(e, cid) {
  if (!e) return null;
  const cands = q("SELECT * FROM candidates WHERE election_id=? ORDER BY created_at", e.id).map(candView);
  const issued = q1("SELECT COUNT(*) n, SUM(voted) v FROM cards WHERE election_id=?", e.id);
  const mine = q1("SELECT * FROM cards WHERE election_id=? AND citizen_id=?", e.id, cid);
  const out = {
    id: e.id, worldId: e.world_id, office: e.office, phase: e.phase, startAt: e.start_at, regEnds: e.reg_ends, voteEnds: e.vote_ends, closedAt: e.closed_at,
    candidates: cands, cardsIssued: issued.n || 0, ballotsCast: issued.v || 0,
    myCard: mine ? { issuedAt: mine.issued_at, voted: !!mine.voted } : null,
    myCandidacy: cands.find((c) => c.citizenId === cid)?.id || null,
    winnerCandidate: e.winner_cand, result: null,
  };
  if (e.phase === "closed" && e.result) out.result = JSON.parse(e.result);
  return out;
}
function eligible(e, cid) { if (!e.world_id) return true; return !!q1("SELECT 1 x FROM world_members WHERE world_id=? AND citizen_id=?", e.world_id, cid); }
function worldRow(w, cid) {
  const members = q1("SELECT COUNT(*) n FROM world_members WHERE world_id=?", w.id).n;
  const my = cid && q1("SELECT role,title FROM world_members WHERE world_id=? AND citizen_id=?", w.id, cid);
  return { id: w.id, name: w.name, motto: w.motto, color: w.color, visibility: w.visibility, ownerId: w.owner_id, owner: nameOf(w.owner_id), createdAt: w.created_at, members, orgs: q1("SELECT COUNT(*) n FROM orgs WHERE world_id=?", w.id).n, myRole: my?.role || null, myTitle: my?.title || null };
}
function orgRow(o, cid) {
  const m = cid && q1("SELECT role,status FROM org_members WHERE org_id=? AND citizen_id=?", o.id, cid);
  return { id: o.id, worldId: o.world_id, kind: o.kind, name: o.name, tag: o.tag, color: o.color, description: o.description, stage: o.stage, stages: STAGES[o.kind], visibility: o.visibility, founder: nameOf(o.founder_id), founderId: o.founder_id, members: q1("SELECT COUNT(*) n FROM org_members WHERE org_id=? AND status='active'", o.id).n, myRole: m?.status === "active" ? m.role : null, myStatus: m?.status || null };
}
const feedOf = (scope, sid) => q("SELECT * FROM feed WHERE scope=? AND scope_id=? ORDER BY created_at DESC LIMIT 60", scope, sid).reverse().map((f) => ({ id: f.id, kind: f.kind, authorId: f.author_id, author: f.author_name, content: f.content, at: f.created_at }));

// ---------- registration ----------
function register(socket, session, ctx) {
  const ip = ctx.hashIp(session.ip);
  const key = String(socket.handshake.auth?.voterKey || "");
  const cid = /^[A-Za-z0-9_-]{16,64}$/.test(key) ? crypto.createHmac("sha256", SECRET).update(key).digest("hex").slice(0, 16) : "s_" + session.sessionId;
  const touch = () => run("INSERT INTO citizens VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET username=excluded.username,last_seen=excluded.last_seen", cid, session.username, now(), now());
  touch();
  if (!sockets.has(cid)) sockets.set(cid, new Set());
  sockets.get(cid).add(socket);
  socket.on("disconnect", () => { sockets.get(cid)?.delete(socket); if (!sockets.get(cid)?.size) sockets.delete(cid); });

  const H = (name, fn, limit = 40) => socket.on("gov:" + name, async (p = {}, ack) => {
    try {
      if (!ctx.rateLimit(`gov:${cid}`, limit, 10000)) fail("Slow down.");
      touch();
      const r = await fn(p || {});
      ack?.({ ok: true, ...(r || {}) });
    } catch (e) {
      if (!e.user) console.error("[gov]", name, e);
      ack?.({ ok: false, error: e.user ? e.message : "Server error" });
    }
  });
  const world = (wid) => q1("SELECT * FROM worlds WHERE id=?", wid) || fail("World not found");
  const wm = (wid, c = cid) => q1("SELECT * FROM world_members WHERE world_id=? AND citizen_id=?", wid, c);
  const isOwner = (w) => w.owner_id === cid;
  const org = (oid) => q1("SELECT * FROM orgs WHERE id=?", oid) || fail("Org not found");
  const om = (oid, c = cid) => q1("SELECT * FROM org_members WHERE org_id=? AND citizen_id=? AND status='active'", oid, c);
  const lead = (oid) => { const m = om(oid); return m && (m.role === "leader" || m.role === "officer") ? m : fail("Leaders only"); };
  const election = (eid) => q1("SELECT * FROM elections WHERE id=?", eid) || fail("Election not found");

  socket.join("gov");
  H("me", () => ({ me: { id: cid, username: session.username }, charter: q1("SELECT * FROM charters WHERE citizen_id=? AND world_id IS NULL AND expires_at>? ORDER BY issued_at DESC", cid, now()) ? true : false, myWorlds: q("SELECT w.* FROM worlds w JOIN world_members m ON m.world_id=w.id WHERE m.citizen_id=?", cid).map((w) => worldRow(w, cid)) }));

  H("republic", () => {
    const cur = q1("SELECT * FROM elections WHERE world_id IS NULL AND phase!='closed'");
    const last = q1("SELECT * FROM elections WHERE world_id IS NULL AND phase='closed' ORDER BY closed_at DESC");
    const hall = q("SELECT e.id, e.closed_at, c.citizen_id, c.slogan FROM elections e JOIN candidates c ON c.id=e.winner_cand WHERE e.world_id IS NULL ORDER BY e.closed_at DESC LIMIT 10").map((h) => ({ id: h.id, at: h.closed_at, name: nameOf(h.citizen_id), slogan: h.slogan, world: q1("SELECT name FROM worlds WHERE owner_id=?", h.citizen_id)?.name || null }));
    return { now: now(), current: electionView(cur, cid), last: electionView(last, cid), hall, parties: q("SELECT * FROM orgs WHERE world_id IS NULL AND kind='party' ORDER BY created_at DESC").map((o) => orgRow(o, cid)), citizens: q1("SELECT COUNT(*) n FROM citizens").n, hasCharter: !!q1("SELECT 1 x FROM charters WHERE citizen_id=? AND world_id IS NULL AND expires_at>?", cid, now()) };
  });
  H("election:get", ({ electionId }) => ({ now: now(), election: electionView(election(electionId), cid) }));

  H("card:claim", ({ electionId }) => {
    const e = election(electionId);
    if (e.phase === "closed" || e.phase === "scheduled") fail("Polls are not open for cards.");
    if (!eligible(e, cid)) fail("Only world citizens can vote here.");
    if (q1("SELECT 1 x FROM cards WHERE election_id=? AND citizen_id=?", e.id, cid)) fail("You already hold a vote card.");
    if (ONE_VOTE_PER_IP && q1("SELECT 1 x FROM cards WHERE election_id=? AND ip_hash=?", e.id, ip)) fail("A card was already issued to this network.");
    run("INSERT INTO cards VALUES(?,?,?,?,0)", e.id, cid, ip, now()); dirty({ electionId: e.id });
  });
  H("candidacy:stand", ({ electionId, slogan, manifesto, partyId }) => {
    const e = election(electionId);
    if (e.phase !== "registration") fail("Candidacy registration is not open.");
    if (!eligible(e, cid)) fail("Join this world first.");
    if (q1("SELECT 1 x FROM candidates WHERE election_id=? AND citizen_id=?", e.id, cid)) fail("Already a candidate.");
    const sl = clean(slogan, 80), mf = clean(manifesto, 600);
    if (sl.length < 3) fail("Write a slogan.");
    let pid = null;
    if (partyId) { const o = org(partyId); if (o.kind !== "party" || (o.world_id || null) !== (e.world_id || null) || !om(o.id)) fail("You must be a member of that party."); pid = o.id; }
    run("INSERT INTO candidates VALUES(?,?,?,?,?,?,?)", id(), e.id, cid, pid, sl, mf, now()); dirty({ electionId: e.id });
  });
  H("candidacy:withdraw", ({ electionId }) => { const e = election(electionId); if (e.phase !== "registration") fail("Too late to withdraw."); run("DELETE FROM candidates WHERE election_id=? AND citizen_id=?", e.id, cid); dirty({ electionId: e.id }); });
  H("vote", ({ electionId, choice }) => {
    const e = election(electionId);
    if (e.phase !== "voting") fail("Polls are not open.");
    const card = q1("SELECT * FROM cards WHERE election_id=? AND citizen_id=?", e.id, cid) || fail("Claim your vote card first.");
    if (card.voted) fail("Your vote card is already used.");
    if (choice !== "NOTA" && !q1("SELECT 1 x FROM candidates WHERE id=? AND election_id=?", choice, e.id)) fail("Invalid candidate.");
    const serial = "VC-" + crypto.randomBytes(4).toString("hex").toUpperCase();
    db.exec("BEGIN");
    try {
      const r = run("UPDATE cards SET voted=1 WHERE election_id=? AND citizen_id=? AND voted=0", e.id, cid);
      if (!r.changes) fail("Your vote card is already used.");
      run("INSERT INTO ballots VALUES(?,?,?)", serial, e.id, choice); // secret ballot: no link to voter
      db.exec("COMMIT");
    } catch (err) { db.exec("ROLLBACK"); throw err; }
    dirty({ electionId: e.id }); return { receipt: serial };
  });
  H("ledger", ({ electionId }) => { const e = election(electionId); if (e.phase !== "closed") fail("Ledger opens after the count."); return { ballots: q("SELECT serial, choice FROM ballots WHERE election_id=? ORDER BY serial", e.id) }; });

  // parties / orgs
  H("org:create", ({ worldId, kind, name, tag, color: col, description, visibility }) => {
    if (!KINDS.includes(kind)) fail("Unknown kind.");
    if (worldId) { world(worldId); if (!wm(worldId)) fail("Join the world first."); } else if (kind !== "party") fail("Only parties exist outside a world.");
    const n = clean(name, 32), t = clean(tag, 5).toUpperCase();
    if (n.length < 3) fail("Name too short.");
    if (q1("SELECT 1 x FROM orgs WHERE lower(name)=lower(?) AND COALESCE(world_id,'')=?", n, worldId || "")) fail("Name taken.");
    if (q1("SELECT COUNT(*) n FROM orgs WHERE founder_id=?", cid).n >= 8) fail("Founder limit reached (8).");
    const oid = id();
    run("INSERT INTO orgs VALUES(?,?,?,?,?,?,?,?,?,?,?)", oid, worldId || null, kind, n, t || n.slice(0, 3).toUpperCase(), color(col), clean(description, 500), STAGES[kind][0], visibility === "approval" ? "approval" : "open", cid, now());
    run("INSERT INTO org_members VALUES(?,?,?,?,?)", oid, cid, "leader", "active", now()); dirty({ worldId }); return { orgId: oid };
  });
  H("orgs:list", ({ worldId }) => ({ orgs: q(worldId ? "SELECT * FROM orgs WHERE world_id=? ORDER BY created_at DESC" : "SELECT * FROM orgs WHERE world_id IS NULL ORDER BY created_at DESC", ...(worldId ? [worldId] : [])).map((o) => orgRow(o, cid)) }));
  H("org:get", ({ orgId }) => {
    const o = org(orgId), r = orgRow(o, cid), lm = !!om(o.id);
    const members = q("SELECT * FROM org_members WHERE org_id=? ORDER BY CASE role WHEN 'leader' THEN 0 WHEN 'officer' THEN 1 ELSE 2 END, joined_at", o.id).filter((m) => m.status === "active" || (r.myRole && ["leader", "officer"].includes(r.myRole))).map((m) => ({ citizenId: m.citizen_id, name: nameOf(m.citizen_id), role: m.role, status: m.status }));
    const projects = lm ? q("SELECT * FROM projects WHERE org_id=? ORDER BY created_at DESC", o.id).map((p) => ({ id: p.id, title: p.title, description: p.description, status: p.status, tasks: q("SELECT * FROM tasks WHERE project_id=? ORDER BY created_at", p.id).map((t) => ({ id: t.id, title: t.title, status: t.status, assigneeId: t.assignee_id, assignee: t.assignee_id ? nameOf(t.assignee_id) : null })) })) : [];
    return { org: r, members, projects, feed: lm ? feedOf("org", o.id) : [], me: cid };
  });
  H("org:join", ({ orgId }) => {
    const o = org(orgId);
    if (o.world_id && !wm(o.world_id)) fail("Join the world first.");
    const ex = q1("SELECT * FROM org_members WHERE org_id=? AND citizen_id=?", o.id, cid);
    if (ex) fail(ex.status === "pending" ? "Request already pending." : "Already a member.");
    const st = o.visibility === "approval" ? "pending" : "active";
    run("INSERT INTO org_members VALUES(?,?,?,?,?)", o.id, cid, "member", st, now()); dirty({ orgId: o.id }); return { status: st };
  });
  H("org:leave", ({ orgId }) => { const o = org(orgId); if (o.founder_id === cid) fail("Founders cannot leave; disband by handing over leadership first."); run("DELETE FROM org_members WHERE org_id=? AND citizen_id=?", orgId, cid); dirty({ orgId }); });
  H("org:member", ({ orgId, citizenId, action }) => {
    const o = org(orgId), me = lead(orgId), t = q1("SELECT * FROM org_members WHERE org_id=? AND citizen_id=?", orgId, citizenId) || fail("Not a member");
    if (action === "accept" && t.status === "pending") run("UPDATE org_members SET status='active' WHERE org_id=? AND citizen_id=?", orgId, citizenId);
    else if (action === "reject" || action === "kick") { if (citizenId === o.founder_id) fail("Cannot remove the founder."); if (t.role === "leader" && me.role !== "leader") fail("No."); run("DELETE FROM org_members WHERE org_id=? AND citizen_id=?", orgId, citizenId); }
    else if (action === "promote" || action === "demote") { if (me.role !== "leader") fail("Only leaders change ranks."); if (citizenId === o.founder_id) fail("Founder rank is fixed."); run("UPDATE org_members SET role=? WHERE org_id=? AND citizen_id=?", action === "promote" ? "officer" : "member", orgId, citizenId); }
    else if (action === "lead") { if (cid !== o.founder_id) fail("Only the founder can share leadership."); run("UPDATE org_members SET role='leader' WHERE org_id=? AND citizen_id=?", orgId, citizenId); }
    else fail("Bad action");
    dirty({ orgId });
  });
  H("org:update", ({ orgId, stage, description }) => {
    const o = org(orgId); lead(orgId);
    if (stage && STAGES[o.kind].includes(stage)) run("UPDATE orgs SET stage=? WHERE id=?", stage, orgId);
    if (description !== undefined) run("UPDATE orgs SET description=? WHERE id=?", clean(description, 500), orgId);
    dirty({ orgId });
  });
  H("project:create", ({ orgId, title, description }) => { lead(orgId); const t = clean(title, 60); if (t.length < 3) fail("Title too short."); run("INSERT INTO projects VALUES(?,?,?,?,?,?,?)", id(), orgId, t, clean(description, 300), "active", cid, now()); dirty({ orgId }); });
  H("project:status", ({ projectId, status }) => { const p = q1("SELECT * FROM projects WHERE id=?", projectId) || fail("?"); lead(p.org_id); if (!["active", "paused", "done"].includes(status)) fail("Bad status"); run("UPDATE projects SET status=? WHERE id=?", status, projectId); dirty({ orgId: p.org_id }); });
  H("task:add", ({ projectId, title }) => { const p = q1("SELECT * FROM projects WHERE id=?", projectId) || fail("?"); if (!om(p.org_id)) fail("Members only"); const t = clean(title, 80); if (t.length < 2) fail("Title too short."); run("INSERT INTO tasks VALUES(?,?,?,?,?,?,?)", id(), projectId, t, "todo", null, cid, now()); dirty({ orgId: p.org_id }); });
  H("task:update", ({ taskId, status, claim }) => {
    const t = q1("SELECT * FROM tasks WHERE id=?", taskId) || fail("?"), p = q1("SELECT * FROM projects WHERE id=?", t.project_id); if (!om(p.org_id)) fail("Members only");
    if (claim) run("UPDATE tasks SET assignee_id=?, status=CASE WHEN status='todo' THEN 'doing' ELSE status END WHERE id=?", cid, taskId);
    if (["todo", "doing", "done"].includes(status)) run("UPDATE tasks SET status=? WHERE id=?", status, taskId);
    dirty({ orgId: p.org_id });
  });
  H("feed:post", ({ scope, scopeId, content }) => {
    const c = clean(content, 400); if (!c) fail("Empty.");
    if (scope === "org") { if (!om(scopeId)) fail("Members only"); }
    else if (scope === "world") { const w = world(scopeId); if (!wm(scopeId)) fail("Citizens only"); if (!isOwner(w) && wm(scopeId).role === "citizen" && false) fail("no"); }
    else fail("Bad scope");
    run("INSERT INTO feed VALUES(?,?,?,?,?,?,?,?)", id(), scope, scopeId, "msg", cid, session.username, c, now()); dirty({ [scope + "Id"]: scopeId });
  }, 15);

  // worlds
  H("worlds:list", () => ({ worlds: q("SELECT * FROM worlds ORDER BY created_at DESC").map((w) => worldRow(w, cid)) }));
  H("world:found", ({ name, motto, color: col, visibility }) => {
    const ch = q1("SELECT * FROM charters WHERE citizen_id=? AND world_id IS NULL AND expires_at>? ORDER BY issued_at DESC", cid, now()) || fail("You need a Sovereign Charter. Win the election.");
    if (q1("SELECT 1 x FROM worlds WHERE owner_id=?", cid)) fail("You already rule a world.");
    const n = clean(name, 28); if (n.length < 3) fail("World name too short.");
    if (q1("SELECT 1 x FROM worlds WHERE lower(name)=lower(?)", n)) fail("World name taken.");
    const wid = id();
    run("INSERT INTO worlds VALUES(?,?,?,?,?,?,?)", wid, n, clean(motto, 80), color(col), cid, visibility === "invite" ? "invite" : "open", now());
    run("INSERT INTO world_members VALUES(?,?,?,?,?)", wid, cid, "sovereign", "Sovereign", now());
    run("UPDATE charters SET world_id=? WHERE id=?", wid, ch.id);
    run("INSERT INTO feed VALUES(?,?,?,?,?,?,?,?)", id(), "world", wid, "decree", cid, session.username, `${n} is founded. All hail Sovereign ${session.username}.`, now());
    dirty(); return { worldId: wid };
  });
  H("world:get", ({ worldId }) => {
    const w = world(worldId), my = wm(w.id);
    const members = q("SELECT * FROM world_members WHERE world_id=? ORDER BY CASE role WHEN 'sovereign' THEN 0 WHEN 'minister' THEN 1 ELSE 2 END, joined_at", w.id).map((m) => ({ citizenId: m.citizen_id, name: nameOf(m.citizen_id), role: m.role, title: m.title }));
    const es = q("SELECT * FROM elections WHERE world_id=? ORDER BY created_at DESC LIMIT 6", w.id).map((e) => electionView(e, cid));
    return { now: now(), world: worldRow(w, cid), members, orgs: q("SELECT * FROM orgs WHERE world_id=? ORDER BY created_at DESC", w.id).map((o) => orgRow(o, cid)), elections: es, feed: my ? feedOf("world", w.id) : [], me: cid, isOwner: isOwner(w) };
  });
  H("world:join", ({ worldId }) => { const w = world(worldId); if (wm(w.id)) fail("Already a citizen."); if (w.visibility === "invite") fail("This world is invite-only."); run("INSERT INTO world_members VALUES(?,?,?,?,?)", w.id, cid, "citizen", null, now()); dirty({ worldId }); });
  H("world:leave", ({ worldId }) => { const w = world(worldId); if (isOwner(w)) fail("A Sovereign cannot abandon their world."); run("DELETE FROM world_members WHERE world_id=? AND citizen_id=?", w.id, cid); run("DELETE FROM org_members WHERE citizen_id=? AND org_id IN (SELECT id FROM orgs WHERE world_id=?)", cid, w.id); dirty({ worldId }); });
  H("world:update", ({ worldId, motto, visibility }) => { const w = world(worldId); if (!isOwner(w)) fail("Sovereign only"); run("UPDATE worlds SET motto=?, visibility=? WHERE id=?", clean(motto, 80), visibility === "invite" ? "invite" : "open", w.id); dirty({ worldId }); });
  H("world:decree", ({ worldId, content }) => { const w = world(worldId); if (!isOwner(w)) fail("Sovereign only"); const c = clean(content, 400); if (!c) fail("Empty."); run("INSERT INTO feed VALUES(?,?,?,?,?,?,?,?)", id(), "world", w.id, "decree", cid, session.username, c, now()); dirty({ worldId }); });
  H("world:appoint", ({ worldId, citizenId, title }) => {
    const w = world(worldId); if (!isOwner(w)) fail("Sovereign only"); const m = wm(w.id, citizenId) || fail("Not a citizen."); if (m.role === "sovereign") fail("No.");
    const t = clean(title, 24); run("UPDATE world_members SET role=?, title=? WHERE world_id=? AND citizen_id=?", t ? "minister" : "citizen", t || null, w.id, citizenId); dirty({ worldId }); tell(citizenId, { type: "info", text: t ? `You were appointed ${t} in ${w.name}.` : `Your title in ${w.name} was revoked.` });
  });
  H("world:banish", ({ worldId, citizenId }) => { const w = world(worldId); if (!isOwner(w)) fail("Sovereign only"); if (citizenId === cid) fail("No."); run("DELETE FROM world_members WHERE world_id=? AND citizen_id=?", w.id, citizenId); run("DELETE FROM org_members WHERE citizen_id=? AND org_id IN (SELECT id FROM orgs WHERE world_id=?)", citizenId, w.id); dirty({ worldId }); });
  H("world:call-election", ({ worldId, office, regMin, voteMin }) => {
    const w = world(worldId); if (!isOwner(w)) fail("Sovereign only");
    if (q1("SELECT 1 x FROM elections WHERE world_id=? AND phase!='closed'", w.id)) fail("An election is already running.");
    const o = clean(office, 24); if (o.length < 3) fail("Name the office.");
    const rm = Math.min(Math.max(+regMin || 10, 1), 1440), vm = Math.min(Math.max(+voteMin || 30, 1), 1440);
    const eid = newElection(w.id, o, now(), rm * 60e3, vm * 60e3); dirty({ worldId }); return { electionId: eid };
  });

  H("admin:advance", ({ token, electionId }) => {
    if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) fail("Not authorised.");
    const e = election(electionId);
    if (e.phase === "scheduled" || e.phase === "registration") { run("UPDATE elections SET phase='registration', reg_ends=? WHERE id=?", now() - 1, e.id); advanceToVoting({ ...e, reg_ends: now() - 1 }); }
    else if (e.phase === "voting") closeElection(e);
  }, 10);
}

module.exports = { init, register };
