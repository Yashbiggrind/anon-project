// diagnose.js — run this to see the real state of the DB
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const DB_PATH = path.join(__dirname, "anon.db");
console.log("DB file:", DB_PATH);
console.log("");

const db = new DatabaseSync(DB_PATH);

// 1. List tables
console.log("=== TABLES ===");
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
for (const t of tables) console.log("  -", t.name);
console.log("");

// 2. Reports schema
console.log("=== reports COLUMNS ===");
try {
  const cols = db.prepare("PRAGMA table_info(reports)").all();
  for (const c of cols) console.log("  -", c.name, "|", c.type);
} catch (e) {
  console.log("  ERROR:", e.message);
}
console.log("");

// 3. Row counts
console.log("=== ROW COUNTS ===");
for (const t of ["reports", "blocks", "strikes"]) {
  try {
    const n = db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c;
    console.log(`  ${t}: ${n}`);
  } catch (e) {
    console.log(`  ${t}: ERROR — ${e.message}`);
  }
}
console.log("");

// 4. Try an insert (dry run)
console.log("=== INSERT TEST ===");
try {
  db.prepare("INSERT INTO reports (id, reporter, target, target_username, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("diag_test_" + Date.now(), "test_reporter", "test_target", "TestUser", "diagnostic", Date.now());
  console.log("  INSERT OK");
  const after = db.prepare("SELECT COUNT(*) AS c FROM reports").get().c;
  console.log("  reports now:", after);
  // Cleanup
  db.prepare("DELETE FROM reports WHERE id LIKE 'diag_test_%'").run();
  console.log("  cleaned up test row");
} catch (e) {
  console.log("  INSERT FAILED:", e.message);
  console.log("  → this is why your reports aren't saving");
}
