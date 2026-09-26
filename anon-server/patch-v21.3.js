// patch-v21.3.js — apply the 3 IP-retention edits to index.js
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "index.js");
let src = fs.readFileSync(file, "utf8");
let applied = 0;

// ---- Edit 3a — log connect ----
const a_from = `  sessions.set(socket.id, session);
  socketBySession.set(session.sessionId, socket.id);`;
const a_to = `  sessions.set(socket.id, session);
  socketBySession.set(session.sessionId, socket.id);

  // v21.3 — log connection for 180-day retention (Rule 3(1)(h))
  db.logConnect(clientIp, session.sessionId, socket.handshake.headers["user-agent"] || "");`;

if (src.includes(a_to)) {
  console.log("Edit 3a already applied — skipping");
} else if (src.includes(a_from)) {
  src = src.replace(a_from, a_to);
  console.log("Edit 3a applied");
  applied++;
} else {
  console.log("Edit 3a FAILED — could not find the connect block");
}

// ---- Edit 3b — log disconnect ----
const b_from = `    sessions.delete(socket.id);
    socketBySession.delete(session.sessionId);`;
const b_to = `    sessions.delete(socket.id);
    socketBySession.delete(session.sessionId);

    // v21.3 — mark session as disconnected in retention log
    db.logDisconnect(s.sessionId);`;

if (src.includes(b_to)) {
  console.log("Edit 3b already applied — skipping");
} else if (src.includes(b_from)) {
  src = src.replace(b_from, b_to);
  console.log("Edit 3b applied");
  applied++;
} else {
  console.log("Edit 3b FAILED — could not find the disconnect block");
}

// ---- Edit 3c — purge old sessions on cleanup interval ----
const c_from = `  decayStrikes();
}, 30000);`;
const c_to = `  decayStrikes();
  // v21.3 — purge session log entries older than 180 days
  const purged = db.purgeOldSessions();
  if (purged > 0) console.log(\`[db] purged \${purged} expired session log(s)\`);
}, 30000);`;

if (src.includes(c_to)) {
  console.log("Edit 3c already applied — skipping");
} else if (src.includes(c_from)) {
  src = src.replace(c_from, c_to);
  console.log("Edit 3c applied");
  applied++;
} else {
  console.log("Edit 3c FAILED — could not find the cleanup interval");
}

// ---- Write back only if all 3 are present now ----
if (src.includes("db.logConnect") && src.includes("db.logDisconnect") && src.includes("db.purgeOldSessions")) {
  fs.writeFileSync(file, src, "utf8");
  console.log("");
  console.log(`Done. ${applied} new edit(s) applied, all 3 markers now present.`);
  console.log("File written: index.js");
} else {
  console.log("");
  console.log("ABORTED — not all 3 edits are present. File unchanged.");
  console.log("Restore from backup: Copy-Item .\\index.js.backup-before-v21.3 .\\index.js -Force");
  process.exit(1);
}
