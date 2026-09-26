// test-client.js — full commands
const { io } = require("socket.io-client");
const socket = io("http://localhost:4000", {
  transports: ["websocket"],
  pingInterval: 10000,
  pingTimeout: 20000,
});

let lastRoomId = null;
let mySessionId = null;
let myUsername = null;

socket.on("connect", () => console.log("[test] connected"));
socket.on("connect_error", (e) => console.log("[test] connect_error:", e.message));
socket.on("disconnect", (r) => console.log("[test] disconnected:", r));

socket.on("session:ready", (s) => {
  mySessionId = s.sessionId;
  myUsername = s.username;
  console.log("[test] session ready:", s.sessionId, s.username);
});

socket.on("room:update", (r) => {
  if (r?.roomId) lastRoomId = r.roomId;
  console.log("[test] room update:", JSON.stringify(r));
});
socket.on("room:system", (p) => console.log("[test] room system:", JSON.stringify(p)));
socket.on("room:message", (m) => console.log("[test] msg:", m.senderName, "->", m.content));
socket.on("invite:received", (inv) => console.log("[test] MY INVITE:", JSON.stringify(inv, null, 2)));
socket.on("room:invite:pending", (p) => console.log("[test] ROOM INVITE PENDING:", JSON.stringify(p, null, 2)));
socket.on("room:invite:resolved", (p) => console.log("[test] INVITE RESOLVED:", JSON.stringify(p)));
socket.on("room:kicked", (p) => console.log("[test] KICKED:", JSON.stringify(p)));

process.stdin.setEncoding("utf8");
process.stdin.resume();
process.stdin.on("data", (buf) => {
  const line = buf.toString().trim();
  if (!line) return;
  const [cmd, ...rest] = line.split(" ");

  if (cmd === "help") console.log(`
  ---- commands ----
  help                              show this
  me                                my sessionId + username
  room                              my current roomId
  quit                              exit

  create <2-10> [topic]             create room
  topic <name>                      change topic (admin)
  slow <0|3|5|10|30>                set slow mode (admin)
  room:list                         list all active rooms
  msg <text>                        send message to room

  invite <username> [message]       invite user
  invites                           list pending invites in my room
  accept <inviteId>                 accept invite

  kick <sessionId>                  kick user (admin)
  timeout <sessionId>               timeout 60s (admin)
  clear <sessionId>                 remove timeout (admin)
  transfer <sessionId>              give admin to another (admin)
  ---- ---------- ----
  `);
  else if (cmd === "me") console.log(`[test] me: ${mySessionId} (${myUsername})`);
  else if (cmd === "room") console.log("[test] roomId:", lastRoomId);
  else if (cmd === "create") {
    socket.emit("room:create", { capacity: Number(rest[0]) || 10, topic: rest.slice(1).join(" ") }, (res) => {
      console.log(res);
      if (res?.ok && res.room?.roomId) lastRoomId = res.room.roomId;
    });
  }
  else if (cmd === "topic") {
    if (!lastRoomId) return console.log("[test] No room yet.");
    socket.emit("room:set-topic", { roomId: lastRoomId, topic: rest.join(" ") }, console.log);
  }
  else if (cmd === "slow") {
    if (!lastRoomId) return console.log("[test] No room yet.");
    socket.emit("room:set-slowmode", { roomId: lastRoomId, seconds: Number(rest[0]) }, console.log);
  }
  else if (cmd === "room:list") {
    socket.emit("room:list", {}, (res) => console.log(JSON.stringify(res, null, 2)));
  }
  else if (cmd === "msg") {
    if (!lastRoomId) return console.log("[test] No room yet.");
    socket.emit("room:message", { roomId: lastRoomId, content: rest.join(" ") }, console.log);
  }
  else if (cmd === "invite") {
    if (!lastRoomId) return console.log("[test] No room yet.");
    socket.emit("room:invite", { roomId: lastRoomId, recipientUsername: rest[0], message: rest.slice(1).join(" ") }, console.log);
  }
  else if (cmd === "invites") {
    if (!lastRoomId) return console.log("[test] No room yet.");
    socket.emit("room:invites:list", { roomId: lastRoomId }, (res) => console.log(JSON.stringify(res, null, 2)));
  }
  else if (cmd === "accept") {
    socket.emit("invite:accept", { inviteId: rest[0] }, console.log);
  }
  else if (cmd === "kick") {
    if (!lastRoomId) return console.log("[test] No room yet.");
    socket.emit("room:kick", { roomId: lastRoomId, targetSessionId: rest[0] }, console.log);
  }
  else if (cmd === "timeout") {
    if (!lastRoomId) return console.log("[test] No room yet.");
    socket.emit("room:timeout", { roomId: lastRoomId, targetSessionId: rest[0], durationMs: 60000 }, console.log);
  }
  else if (cmd === "clear") {
    if (!lastRoomId) return console.log("[test] No room yet.");
    socket.emit("room:clear-timeout", { roomId: lastRoomId, targetSessionId: rest[0] }, console.log);
  }
  else if (cmd === "transfer") {
    if (!lastRoomId) return console.log("[test] No room yet.");
    socket.emit("room:transfer-admin", { roomId: lastRoomId, targetSessionId: rest[0] }, console.log);
  }
  else if (cmd === "quit") { console.log("[test] bye"); process.exit(0); }
  else console.log("[test] unknown. Type: help");
});

console.log("[test] client started — waiting for connection...");
