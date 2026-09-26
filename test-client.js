// test-client.js
const { io } = require("./anon-server/node_modules/socket.io-client");

const socket = io("http://localhost:4000", {
  transports: ["websocket"],
});

let lastRoomId = null;

socket.on("connect", () => {
  console.log("[test] connected as", socket.id);
  console.log("[test] READY — send commands by typing in this terminal");
});

socket.on("session:ready", (s) => {
  console.log("[test] session ready:", s.sessionId, s.username);
});

socket.on("room:update", (r) => {
  if (r && r.roomId) {
    lastRoomId = r.roomId;
    console.log("[test] room update:", JSON.stringify(r, null, 2));
  }
});

socket.on("room:system", (p) => console.log("[test] room system:", p));
socket.on("invite:received", (inv) => console.log("[test] invite:", inv));
socket.on("room:kicked", (p) => console.log("[test] KICKED:", p));
socket.on("room:message", (m) => console.log("[test] room msg:", m.senderName, "->", m.content));

process.stdin.on("data", (buf) => {
  const line = buf.toString().trim();
  if (!line) return;
  const [cmd, ...rest] = line.split(" ");

  if (cmd === "create") {
    socket.emit("room:create", { capacity: Number(rest[0]) || 10, topic: rest.slice(1).join(" ") }, console.log);
  } else if (cmd === "invite") {
    if (!lastRoomId) return console.log("[test] No room yet. Create one first.");
    socket.emit("room:invite", { roomId: lastRoomId, recipientUsername: rest[0] }, console.log);
  } else if (cmd === "msg") {
    if (!lastRoomId) return console.log("[test] No room yet. Create one first.");
    socket.emit("room:message", { roomId: lastRoomId, content: rest.slice(1).join(" ") }, console.log);
  } else if (cmd === "accept") {
    socket.emit("invite:accept", { inviteId: rest[0] }, console.log);
  } else if (cmd === "kick") {
    if (!lastRoomId) return console.log("[test] No room yet.");
    socket.emit("room:kick", { roomId: lastRoomId, targetSessionId: rest[0] }, console.log);
  } else if (cmd === "timeout") {
    if (!lastRoomId) return console.log("[test] No room yet.");
    socket.emit("room:timeout", { roomId: lastRoomId, targetSessionId: rest[0], durationMs: 60000 }, console.log);
  } else if (cmd === "transfer") {
    if (!lastRoomId) return console.log("[test] No room yet.");
    socket.emit("room:transfer-admin", { roomId: lastRoomId, targetSessionId: rest[0] }, console.log);
  } else if (cmd === "quit") {
    process.exit(0);
  } else {
    console.log("[test] unknown command. Try: create, invite, msg, kick, timeout, transfer, quit");
  }
});
