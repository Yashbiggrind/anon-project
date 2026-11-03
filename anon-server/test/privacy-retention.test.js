/**
 * Regression tests for the privacy retention boundary.
 * Uses an isolated temporary SQLite database and synthetic records only.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "anon-retention-test-"));
const databasePath = path.join(directory, "test.sqlite");
process.env.ANON_DB_PATH = databasePath;
process.env.ANON_SESSION_LOGS = "off";
process.env.NODE_ENV = "test";

const db = require("../db");
db.init();
const writer = new DatabaseSync(databasePath);
const DAY_MS = 24 * 60 * 60 * 1000;

test("retention deletes only old reviewed reports and inactive expired strikes", () => {
  const now = Date.now();
  const insertReport = writer.prepare(
    "INSERT INTO reports (id, reporter, target, reason, created_at, reviewed) VALUES (?, ?, ?, ?, ?, ?)"
  );
  insertReport.run("reviewed-old", "r1", "t1", "synthetic", now - 91 * DAY_MS, 1);
  insertReport.run("unreviewed-old", "r2", "t2", "synthetic", now - 200 * DAY_MS, 0);
  insertReport.run("reviewed-recent", "r3", "t3", "synthetic", now - 5 * DAY_MS, 1);

  const insertStrike = writer.prepare(
    "INSERT INTO strikes (spam_key, count, level, last_offense, cooldown_until, shadow_banned_until, warnings_shown, updated_at) VALUES (?, 1, 1, ?, ?, ?, 0, ?)"
  );
  insertStrike.run("expired-old", now - 40 * DAY_MS, 0, 0, now - 31 * DAY_MS);
  insertStrike.run("active-cooldown", now - 80 * DAY_MS, now + DAY_MS, 0, now - 40 * DAY_MS);
  insertStrike.run("active-ban", now - 80 * DAY_MS, 0, now + DAY_MS, now - 40 * DAY_MS);
  insertStrike.run("recent-strike", now - DAY_MS, 0, 0, now - DAY_MS);

  const removed = db.purgeOldSafetyRecords(now);
  assert.deepEqual(removed, { reports: 1, strikes: 1 });

  const remainingReports = writer.prepare("SELECT id FROM reports ORDER BY id").all().map((r) => r.id);
  assert.deepEqual(remainingReports, ["reviewed-recent", "unreviewed-old"]);

  const remainingStrikes = writer.prepare("SELECT spam_key FROM strikes ORDER BY spam_key").all().map((r) => r.spam_key);
  assert.deepEqual(remainingStrikes, ["active-ban", "active-cooldown", "recent-strike"]);
});

test("session logging is off by default, refuses writes, and hides stale counts", () => {
  assert.equal(db.isSessionLoggingEnabled(), false);
  db.logConnect("203.0.113.10", "synthetic-session", "synthetic-agent");
  assert.equal(writer.prepare("SELECT COUNT(*) AS count FROM sessions_log").get().count, 0);

  // Simulate a legacy/stale row appearing after startup. Public session APIs must
  // still return nothing while logging is disabled, even before the next restart.
  writer.prepare(
    "INSERT INTO sessions_log (ip_hash, session_id, connected_at, user_agent) VALUES (?, ?, ?, ?)"
  ).run("synthetic-hash", "stale-session", Date.now(), "synthetic-agent");
  assert.equal(db.getSessionCount(), 0);
  assert.deepEqual(db.listSessions(), []);
});
