require("dotenv").config();
// db.js — v21.3 SQLite persistence for ANON
// Adds: sessions_log table for IP retention (Rule 3(1)(h) compliance)
const path = require("path");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");

const DB_PATH = path.join(__dirname, "anon.db");
const IP_HASH_SECRET = process.env.IP_HASH_SECRET || "change-me-in-env";
const RETENTION_DAYS = 180;

let db = null;
let ready = false;

// ---- IP hashing (HMAC-SHA256, 32 hex chars = 128 bits) ----
function hashIp(rawIp) {
  if (!rawIp) return "unknown";
  return crypto
    .createHmac("sha256", IP_HASH_SECRET)
    .update(String(rawIp))
    .digest("hex")
    .slice(0, 32);
}

function init() {
  try {
    db = new DatabaseSync(DB_PATH);
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA synchronous = NORMAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        reporter TEXT NOT NULL,
        target TEXT NOT NULL,
        target_username TEXT,
        reason TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        reviewed INTEGER NOT NULL DEFAULT 0,
        action_taken TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_reports_reviewed ON reports(reviewed);
      CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at DESC);

      CREATE TABLE IF NOT EXISTS blocks (
        blocker_key TEXT NOT NULL,
        blocked_key TEXT NOT NULL,
        blocked_username TEXT,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (blocker_key, blocked_key)
      );

      CREATE TABLE IF NOT EXISTS strikes (
        spam_key TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 0,
        level INTEGER NOT NULL DEFAULT 0,
        last_offense INTEGER NOT NULL DEFAULT 0,
        cooldown_until INTEGER NOT NULL DEFAULT 0,
        shadow_banned_until INTEGER NOT NULL DEFAULT 0,
        warnings_shown INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_strikes_updated ON strikes(updated_at DESC);

      CREATE TABLE IF NOT EXISTS sessions_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip_hash TEXT NOT NULL,
        session_id TEXT NOT NULL,
        connected_at INTEGER NOT NULL,
        disconnected_at INTEGER,
        user_agent TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_ip ON sessions_log(ip_hash);
      CREATE INDEX IF NOT EXISTS idx_sessions_connected ON sessions_log(connected_at DESC);
      CREATE INDEX IF NOT EXISTS idx_sessions_session ON sessions_log(session_id);
    `);
    try { db.exec("ALTER TABLE reports ADD COLUMN target_username TEXT"); } catch { /* exists */ }
    ready = true;
    console.log("[db] ready at", DB_PATH);
    console.log("[db] IP retention: 180 days, HMAC secret =",
      IP_HASH_SECRET === "change-me-in-env" ? "DEFAULT (change in .env!)" : "set");
  } catch (err) {
    console.error("[db] failed to initialize:", err.message);
    console.error(err.stack);
    db = null;
    ready = false;
  }
}

// ---------- reports ----------
function saveReport(r) {
  if (!ready) return;
  try {
    db.prepare("INSERT INTO reports (id, reporter, target, target_username, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(r.id, r.reporter, r.target, r.targetUsername || null, r.reason, r.createdAt);
  } catch (e) { console.error("[db] saveReport:", e.message); }
}
function listReports(limit = 100, onlyUnreviewed = false) {
  if (!ready) return [];
  try {
    const sql = onlyUnreviewed
      ? "SELECT * FROM reports WHERE reviewed = 0 ORDER BY created_at DESC LIMIT ?"
      : "SELECT * FROM reports ORDER BY created_at DESC LIMIT ?";
    return db.prepare(sql).all(limit).map(rowToReport);
  } catch (e) { console.error("[db] listReports:", e.message); return []; }
}
function markReportReviewed(id, action) {
  if (!ready) return;
  try {
    db.prepare("UPDATE reports SET reviewed = 1, action_taken = ? WHERE id = ?").run(action || null, id);
  } catch (e) { console.error("[db] markReportReviewed:", e.message); }
}
function rowToReport(r) {
  return {
    id: r.id, reporter: r.reporter, target: r.target,
    targetUsername: r.target_username || "",
    reason: r.reason, createdAt: r.created_at,
    reviewed: !!r.reviewed, actionTaken: r.action_taken || null,
  };
}

// ---------- strikes ----------
function saveStrike(spamKey, s) {
  if (!ready) return;
  try {
    db.prepare(`
      INSERT INTO strikes (spam_key, count, level, last_offense, cooldown_until, shadow_banned_until, warnings_shown, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(spam_key) DO UPDATE SET
        count = excluded.count, level = excluded.level, last_offense = excluded.last_offense,
        cooldown_until = excluded.cooldown_until, shadow_banned_until = excluded.shadow_banned_until,
        warnings_shown = excluded.warnings_shown, updated_at = excluded.updated_at
    `).run(
      spamKey, s.count || 0, s.level || 0, s.lastOffense || 0,
      s.cooldownUntil || 0, s.shadowBannedUntil || 0, s.warningsShown || 0, Date.now()
    );
  } catch (e) { console.error("[db] saveStrike:", e.message); }
}
function deleteStrike(spamKey) {
  if (!ready) return;
  try { db.prepare("DELETE FROM strikes WHERE spam_key = ?").run(spamKey); }
  catch (e) { console.error("[db] deleteStrike:", e.message); }
}
function loadAllStrikes() {
  if (!ready) return [];
  try {
    return db.prepare("SELECT * FROM strikes").all().map((r) => ({
      spamKey: r.spam_key, count: r.count, level: r.level,
      lastOffense: r.last_offense, cooldownUntil: r.cooldown_until,
      shadowBannedUntil: r.shadow_banned_until, warningsShown: r.warnings_shown,
    }));
  } catch (e) { console.error("[db] loadAllStrikes:", e.message); return []; }
}

// ---------- v21.3 — session log (IP retention) ----------
function logConnect(rawIp, sessionId, userAgent) {
  if (!ready) return;
  try {
    const ipHash = hashIp(rawIp);
    const stmt = db.prepare(
      "INSERT INTO sessions_log (ip_hash, session_id, connected_at, user_agent) VALUES (?, ?, ?, ?)"
    );
    stmt.run(ipHash, String(sessionId), Date.now(), String(userAgent || "").slice(0, 200));
  } catch (e) { console.error("[db] logConnect:", e.message); }
}

function logDisconnect(sessionId) {
  if (!ready) return;
  try {
    db.prepare(
      "UPDATE sessions_log SET disconnected_at = ? WHERE session_id = ? AND disconnected_at IS NULL"
    ).run(Date.now(), String(sessionId));
  } catch (e) { console.error("[db] logDisconnect:", e.message); }
}

function purgeOldSessions() {
  if (!ready) return 0;
  try {
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const info = db.prepare("DELETE FROM sessions_log WHERE connected_at < ?").run(cutoff);
    return info.changes;
  } catch (e) { console.error("[db] purgeOldSessions:", e.message); return 0; }
}

function listSessions({ since = 0, until = Date.now(), ipHash = null, limit = 500 } = {}) {
  if (!ready) return [];
  try {
    let sql = "SELECT * FROM sessions_log WHERE connected_at >= ? AND connected_at <= ?";
    const args = [since, until];
    if (ipHash) { sql += " AND ip_hash = ?"; args.push(ipHash); }
    sql += " ORDER BY connected_at DESC LIMIT ?";
    args.push(limit);
    return db.prepare(sql).all(...args).map((r) => ({
      id: r.id,
      ipHash: r.ip_hash,
      sessionId: r.session_id,
      connectedAt: r.connected_at,
      disconnectedAt: r.disconnected_at,
      userAgent: r.user_agent || "",
    }));
  } catch (e) { console.error("[db] listSessions:", e.message); return []; }
}

function getSessionCount() {
  if (!ready) return 0;
  try { return db.prepare("SELECT COUNT(*) AS c FROM sessions_log").get().c; }
  catch { return 0; }
}

// ---------- stats ----------
function getStats() {
  if (!ready) return null;
  try {
    return {
      reports: db.prepare("SELECT COUNT(*) AS c FROM reports").get().c,
      unreviewed: db.prepare("SELECT COUNT(*) AS c FROM reports WHERE reviewed = 0").get().c,
      strikes: db.prepare("SELECT COUNT(*) AS c FROM strikes").get().c,
      sessions: db.prepare("SELECT COUNT(*) AS c FROM sessions_log").get().c,
    };
  } catch (e) { console.error("[db] getStats:", e.message); return null; }
}

module.exports = {
  init,
  isReady: () => ready,
  hashIp,
  saveReport, listReports, markReportReviewed,
  saveStrike, deleteStrike, loadAllStrikes,
  logConnect, logDisconnect, purgeOldSessions,
  listSessions, getSessionCount,
  getStats,
};