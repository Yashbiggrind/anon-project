// ANON// backend â€” Node + Express + Socket.IO
require("dotenv").config();
const express = require("express");
const http = require("http");
const os = require("os");
const cors = require("cors");
const { Server } = require("socket.io");
const db = require("./db");
const { registerAdmin } = require("./admin");
const PORT = parseInt(process.env.PORT || "4000", 10);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "*";
const MAX_MSG = parseInt(process.env.MAX_MSG_LENGTH || "1000", 10);
const RATE_MSG = parseInt(process.env.RATE_MSG_PER_10S || "15", 10);
const RATE_INV = parseInt(process.env.RATE_INVITE_PER_MIN || "5", 10);
const RATE_ROOM = parseInt(process.env.RATE_ROOM_CREATE_PER_MIN || "3", 10);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

// ---------- v20 room config ----------
const MIN_ROOM_CAPACITY = 2;
const MAX_ROOM_CAPACITY = 10;
const TIMEOUT_OPTIONS_MS = [60 * 1000, 3 * 60 * 1000, 5 * 60 * 1000];
const SLOW_MODE_OPTIONS_SEC = [0, 3, 5, 10, 30];
const ROOM_TOPIC_MAX = 40;

// ---------- CORS origin checker ----------
const PRIVATE_IP = /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;
function corsOrigin(origin, cb) {
  if (!origin) return cb(null, true);
  if (CLIENT_ORIGIN === "*") return cb(null, true);
  if (origin === CLIENT_ORIGIN) return cb(null, true);
  if (PRIVATE_IP.test(origin)) return cb(null, true);
  return cb(new Error(`CORS blocked: ${origin}`), false);
}

// ---------- state ----------
const sessions = new Map();
const socketBySession = new Map();
const invites = new Map();
const rooms = new Map();
const sessionRooms = new Map();
const dmThreads = new Map();
const DM_TTL_MS = 60 * 60 * 1000;
const DM_MAX_MESSAGES = 200;
const rateBuckets = new Map();
const reports = [];
const reactions = new Map();
const reactionTimes = new Map();
const REACTION_RATE = 20;
const REACTION_TTL = 60 * 60 * 1000;

const messageOwners = new Map();
const MESSAGE_TTL = 24 * 60 * 60 * 1000;

// ============================================================
// v17 â€” ANTI-SPAM ENGINE
// ============================================================
const SPAM_CONFIG = {
  DUPLICATE_WINDOW_MS: 60000,
  DUPLICATE_THRESHOLD: 2,
  BURST_WINDOW_MS: 5000,
  BURST_THRESHOLD: 8,
  LINK_THRESHOLD: 3,
  REPEAT_WINDOW_MS: 120000,
  REPEAT_THRESHOLD: 4,
  STRIKE_DECAY_MS: 30 * 60 * 1000,
  COOLDOWN_L1: 30000,
  COOLDOWN_L2: 5 * 60 * 1000,
  COOLDOWN_L3: 15 * 60 * 1000,
  SHADOW_BAN_AT: 10,
  SHADOW_BAN_DURATION_MS: 60 * 60 * 1000,
  WARNINGS_BEFORE_VISIBLE: 3,
  HYBRID_MODE: true,
};

const messageFingerprints = new Map();
const burstWindows = new Map();
const strikeRecords = new Map();

const publicHistory = [];
const PUBLIC_HISTORY_MAX = 500;
const PUBLIC_HISTORY_TTL = 24 * 60 * 60 * 1000;

// ---------- utils ----------
const ADJ = ["Silent","Red","Dark","Crimson","Night","Shadow","Iron","Neon","Quiet","Hollow","Frozen","Lost"];
const NOUNS = ["Wolf","Shadow","Fox","Ghost","Crow","Raven","Serpent","Cipher","Echo","Drift","Nomad","Wraith"];
const ACCENTS = ["#ff2d55","#e11d48","#f43f5e","#b91c1c"];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const makeUsername = () => `${pick(ADJ)}${pick(NOUNS)}${Math.floor(100 + Math.random() * 900)}`;
const makeId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const clean = (s) => String(s ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");

const EMOJI_TEST = /\p{Extended_Pictographic}|\p{Emoji_Presentation}|\u200D|\uFE0F/u;

const MAX_IMAGE_B64 = 280 * 1024;
const IMAGE_DATA_URL = /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/;
function isImageData(str) {
  if (typeof str !== "string") return false;
  if (str.length < 100 || str.length > MAX_IMAGE_B64) return false;
  return IMAGE_DATA_URL.test(str);
}
function isEmoji(str) {
  if (typeof str !== "string") return false;
  if (str.length < 1 || str.length > 32) return false;
  if (!EMOJI_TEST.test(str)) return false;
  if (/[A-Za-z0-9\s<>"'`]/.test(str)) return false;
  return true;
}

function getClientIp(socket) {
  const fwd = socket.handshake.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return socket.handshake.address || "unknown";
}

function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const arr = (rateBuckets.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) { rateBuckets.set(key, arr); return false; }
  arr.push(now);
  rateBuckets.set(key, arr);
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, arr] of rateBuckets) {
    const fresh = arr.filter((t) => now - t < 60000);
    if (!fresh.length) rateBuckets.delete(k); else rateBuckets.set(k, fresh);
  }
  for (const [mid, ts] of reactionTimes) {
    if (now - ts > REACTION_TTL) {
      reactions.delete(mid);
      reactionTimes.delete(mid);
    }
  }
  for (const [mid, meta] of messageOwners) {
    if (now - meta.createdAt > MESSAGE_TTL) messageOwners.delete(mid);
  }
  for (const [k, fps] of messageFingerprints) {
    const fresh = fps.filter((f) => now - f.at < SPAM_CONFIG.REPEAT_WINDOW_MS);
    if (fresh.length) messageFingerprints.set(k, fresh);
    else messageFingerprints.delete(k);
  }
  for (const [k, burst] of burstWindows) {
    const fresh = burst.filter((t) => now - t < SPAM_CONFIG.BURST_WINDOW_MS);
    if (fresh.length) burstWindows.set(k, fresh);
    else burstWindows.delete(k);
  }
  const histCut = now - PUBLIC_HISTORY_TTL;
  while (publicHistory.length && publicHistory[0].createdAt < histCut) {
    publicHistory.shift();
  }
  for (const room of rooms.values()) {
    for (const [sid, until] of room.timeouts) {
      if (until <= now) room.timeouts.delete(sid);
    }
  }
  for (const [threadId, thread] of dmThreads) {
    if (now - thread.lastAt > DM_TTL_MS) {
      dmThreads.delete(threadId);
    }
  }
  decayStrikes();
  // v21.3 â€” purge session log entries older than 180 days
  {
    const purged = db.purgeOldSessions();
    if (purged > 0) console.log(`[db] purged ${purged} expired session log(s)`);
  }
}, 30000);

// ---------- express ----------
const app = express();
app.use(cors({ origin: corsOrigin, credentials: false }));
app.use(express.json({ limit: "200kb" }));
app.get("/", (req, res) => res.json({ ok: true, online: sessions.size, rooms: rooms.size }));
app.get("/api/stats", (req, res) => {
  let persistent = 0;
  try { persistent = db.countAll ? db.countAll() : 0; } catch { persistent = 0; }
  res.json({
    online: sessions.size,
    away: 0,
    rooms: rooms.size,
    recent: publicHistory.length,
    recent_max: PUBLIC_HISTORY_MAX,
    uptime_ms: Math.round(process.uptime() * 1000),
    databases: 1,
    persistent_rows: persistent,
  });
});

registerAdmin({ app, db, sessions, strikeRecords, rooms, ADMIN_TOKEN });

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: corsOrigin, methods: ["GET","POST"], credentials: false },
});

// ---------- helpers ----------
const publicUser = (s) => ({
  sessionId: s.sessionId, username: s.username, accent: s.accent, status: s.status || "available",
});

const publicRoom = (r) => ({
  roomId: r.roomId,
  host: r.host,
  admin: r.admin,
  topic: r.topic,
  capacity: r.capacity,
  slowMode: r.slowMode,
    messageLifetime: r.messageLifetime || 0,
  participants: r.participants.map((p) => ({
    sessionId: p.sessionId,
    username: p.username,
    isAdmin: p.sessionId === r.admin,
    isHost: p.sessionId === r.host,
    timedOutUntil: r.timeouts.get(p.sessionId) || 0,
  })),
  status: r.status,
});

const findSocketBySession = (sid) => socketBySession.get(sid) || null;

function isBlocked(a, b) {
  const s = sessions.get(findSocketBySession(a) || "");
  return s ? s.blocked.has(b) : false;
}
function isMutuallyBlocked(a, b) {
  return isBlocked(a, b) || isBlocked(b, a);
}

function broadcastOnline() {
  for (const [socketId, session] of sessions) {
    const list = [];
    for (const u of sessions.values()) {
      if (u.sessionId === session.sessionId) continue;
      if (session.blocked.has(u.sessionId)) continue;
      if (u.blocked.has(session.sessionId)) continue;
      list.push(publicUser(u));
    }
    io.to(socketId).emit("online:list", list);
  }
}

function broadcastPublicMessage(msg) {
  const shadowed = isShadowBanned(msg.senderSpamKey);
  if (!shadowed) {
    publicHistory.push(msg);
    if (publicHistory.length > PUBLIC_HISTORY_MAX) {
      publicHistory.splice(0, publicHistory.length - PUBLIC_HISTORY_MAX);
    }
  }
  for (const [socketId, session] of sessions) {
    if (
      session.sessionId !== msg.senderSessionId &&
      (session.blocked.has(msg.senderSessionId) || isBlocked(msg.senderSessionId, session.sessionId))
    ) continue;
    if (shadowed && session.sessionId !== msg.senderSessionId) continue;
    io.to(socketId).emit("chat:public:message", msg);
  }
}

function broadcastSystemFor(userSessionId, payload) {
  for (const [socketId, session] of sessions) {
    if (session.sessionId !== userSessionId &&
      (session.blocked.has(userSessionId) || isBlocked(userSessionId, session.sessionId))) continue;
    io.to(socketId).emit("system:public", payload);
  }
}

function broadcastRoomMessage(room, msg) {
  const shadowed = isShadowBanned(msg.senderSpamKey);
  for (const p of room.participants) {
    if (
      p.sessionId !== msg.senderSessionId &&
      (isMutuallyBlocked(p.sessionId, msg.senderSessionId))
    ) continue;
    if (shadowed && p.sessionId !== msg.senderSessionId) continue;
    const sid = findSocketBySession(p.sessionId);
    if (sid) io.to(sid).emit("room:message", msg);
  }
}

function broadcastRoomUpdate(room) {
  for (const p of room.participants) {
    const sid = findSocketBySession(p.sessionId);
    if (sid) io.to(sid).emit("room:update", publicRoom(room));
  }
}

function broadcastRoomSystem(room, payload) {
  for (const p of room.participants) {
    const sid = findSocketBySession(p.sessionId);
    if (sid) io.to(sid).emit("room:system", { roomId: room.roomId, at: Date.now(), ...payload });
  }
}

function sanitizeReply(replyTo) {
  if (!replyTo || typeof replyTo !== "object") return undefined;
  const id = String(replyTo.id || "").slice(0, 32);
  const senderName = String(replyTo.senderName || "").slice(0, 40);
  const content = clean(String(replyTo.content || "")).slice(0, 200);
  if (!id || !senderName) return undefined;
  return { id, senderName, content };
}

function getReactionsFor(messageId, viewerSessionId) {
  const m = reactions.get(messageId);
  if (!m) return [];
  const out = [];
  for (const [emoji, set] of m) {
    if (set.size === 0) continue;
    out.push({ emoji, count: set.size, mine: set.has(viewerSessionId) });
  }
  return out;
}

function broadcastReactionPublic(messageId, actorSessionId) {
  for (const [socketId, session] of sessions) {
    if (
      session.sessionId !== actorSessionId &&
      (session.blocked.has(actorSessionId) || isBlocked(actorSessionId, session.sessionId))
    ) continue;
    io.to(socketId).emit("reaction:update", {
      messageId,
      reactions: getReactionsFor(messageId, session.sessionId),
    });
  }
}

// ---------- anti-spam helpers ----------
function hashMessage(text) {
  let h = 0;
  const s = String(text || "").toLowerCase().trim();
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return String(h);
}

function countLinks(text) {
  const m = String(text || "").match(/https?:\/\/[^\s]+/gi);
  return m ? m.length : 0;
}

function getStrike(spamKey) {
  let s = strikeRecords.get(spamKey);
  if (!s) {
    s = { count: 0, level: 0, lastOffense: 0, cooldownUntil: 0, shadowBannedUntil: 0, warningsShown: 0 };
    strikeRecords.set(spamKey, s);
  }
  return s;
}

function isShadowBanned(spamKey) {
  if (!spamKey) return false;
  const s = strikeRecords.get(spamKey);
  if (!s || !s.shadowBannedUntil) return false;
  if (Date.now() > s.shadowBannedUntil) { s.shadowBannedUntil = 0; return false; }
  return true;
}

function isCooling(spamKey) {
  const s = strikeRecords.get(spamKey);
  if (!s) return 0;
  const r = s.cooldownUntil - Date.now();
  return r > 0 ? r : 0;
}

function applyStrike(spamKey, reason, socketId) {
  const s = getStrike(spamKey);
  s.count += 1;
  s.lastOffense = Date.now();
  s.level = s.count;

  const result = (() => {
    if (s.count >= SPAM_CONFIG.SHADOW_BAN_AT) {
      s.shadowBannedUntil = Date.now() + SPAM_CONFIG.SHADOW_BAN_DURATION_MS;
      console.log(`[spam] SHADOW-BAN ${spamKey} reason=${reason}`);
      return { action: "shadow-ban", ms: SPAM_CONFIG.SHADOW_BAN_DURATION_MS };
    }
    if (s.count >= 6) {
      s.cooldownUntil = Date.now() + SPAM_CONFIG.COOLDOWN_L3;
      if (socketId) io.to(socketId).emit("spam:cooldown", { ms: SPAM_CONFIG.COOLDOWN_L3, reason });
      console.log(`[spam] L3 cooldown ${spamKey} ${SPAM_CONFIG.COOLDOWN_L3}ms`);
      return { action: "cooldown", ms: SPAM_CONFIG.COOLDOWN_L3 };
    }
    if (s.count >= 3) {
      s.cooldownUntil = Date.now() + SPAM_CONFIG.COOLDOWN_L2;
      if (socketId) io.to(socketId).emit("spam:cooldown", { ms: SPAM_CONFIG.COOLDOWN_L2, reason });
      console.log(`[spam] L2 cooldown ${spamKey} ${SPAM_CONFIG.COOLDOWN_L2}ms`);
      return { action: "cooldown", ms: SPAM_CONFIG.COOLDOWN_L2 };
    }
    s.cooldownUntil = Date.now() + SPAM_CONFIG.COOLDOWN_L1;
    s.warningsShown += 1;
    if (socketId) {
      io.to(socketId).emit("spam:warning", {
        reason,
        strikeCount: s.count,
        visible: s.warningsShown <= SPAM_CONFIG.WARNINGS_BEFORE_VISIBLE,
      });
    }
    console.log(`[spam] warning ${spamKey} #${s.count} reason=${reason}`);
    return { action: "warning", count: s.count };
  })();

  db.saveStrike(spamKey, s);
  return result;
}

function checkSpam(spamKey, content, socketId) {
  const now = Date.now();

  const remain = isCooling(spamKey);
  if (remain > 0) return { blocked: true, reason: "cooldown", cooldownMs: remain };

  const hash = hashMessage(content);
  let fps = messageFingerprints.get(spamKey);
  if (!fps) { fps = []; messageFingerprints.set(spamKey, fps); }

  const dupCount = fps.filter(
    (f) => f.hash === hash && now - f.at < SPAM_CONFIG.DUPLICATE_WINDOW_MS
  ).length;

  const repCount = fps.filter(
    (f) => f.hash === hash && now - f.at < SPAM_CONFIG.REPEAT_WINDOW_MS
  ).length;

  fps.push({ hash, at: now });
  messageFingerprints.set(spamKey, fps.slice(-40));

  if (repCount >= SPAM_CONFIG.REPEAT_THRESHOLD) {
    applyStrike(spamKey, "repetition", socketId);
    return { blocked: true, reason: "repetition" };
  }
  if (dupCount >= SPAM_CONFIG.DUPLICATE_THRESHOLD) {
    applyStrike(spamKey, "duplicate", socketId);
    return { blocked: true, reason: "duplicate" };
  }

  let burst = burstWindows.get(spamKey);
  if (!burst) { burst = []; burstWindows.set(spamKey, burst); }
  burst = burst.filter((t) => now - t < SPAM_CONFIG.BURST_WINDOW_MS);
  burst.push(now);
  burstWindows.set(spamKey, burst.slice(-40));
  if (burst.length >= SPAM_CONFIG.BURST_THRESHOLD) {
    applyStrike(spamKey, "burst", socketId);
    return { blocked: true, reason: "burst" };
  }

  if (countLinks(content) >= SPAM_CONFIG.LINK_THRESHOLD) {
    applyStrike(spamKey, "links", socketId);
    return { blocked: true, reason: "links" };
  }

  return { blocked: false };
}

function decayStrikes() {
  const now = Date.now();
  for (const [spamKey, s] of strikeRecords) {
    let changed = false;

    if (s.lastOffense && now - s.lastOffense > SPAM_CONFIG.STRIKE_DECAY_MS) {
      const steps = Math.floor((now - s.lastOffense) / SPAM_CONFIG.STRIKE_DECAY_MS);
      s.count = Math.max(0, s.count - steps);
      s.level = Math.max(0, s.level - steps);
      s.lastOffense = s.lastOffense + steps * SPAM_CONFIG.STRIKE_DECAY_MS;
      changed = true;
    }
    if (s.cooldownUntil && s.cooldownUntil < now) { s.cooldownUntil = 0; changed = true; }
    if (s.shadowBannedUntil && s.shadowBannedUntil < now) {
      s.shadowBannedUntil = 0;
      s.count = 0;
      s.level = 0;
      s.warningsShown = 0;
      console.log(`[spam] shadow-ban expired for ${spamKey}`);
      changed = true;
    }
    if (!s.cooldownUntil && !s.shadowBannedUntil && s.count === 0) {
      strikeRecords.delete(spamKey);
      db.deleteStrike(spamKey);
      continue;
    }
    if (changed) db.saveStrike(spamKey, s);
  }
}

// ---------- room helpers ----------
function isRoomAdmin(room, sessionId) {
  return room && room.admin === sessionId;
}
function roomTimeoutRemaining(room, sessionId) {
  const until = room.timeouts.get(sessionId);
  if (!until) return 0;
  const r = until - Date.now();
  if (r <= 0) { room.timeouts.delete(sessionId); return 0; }
  return r;
}
function roomSlowModeRemaining(room, sessionId) {
  if (!room.slowMode) return 0;
  const last = room.lastMessageAt.get(sessionId) || 0;
  const r = room.slowMode * 1000 - (Date.now() - last);
  return r > 0 ? r : 0;
}
function sanitizeTopic(t) {
  return clean(String(t || "")).trim().slice(0, ROOM_TOPIC_MAX);
}

// ---------- DM helpers ----------
function dmThreadId(sidA, sidB) {
  return [sidA, sidB].sort().join("::");
}
function getOrCreateDmThread(sidA, sidB) {
  const threadId = dmThreadId(sidA, sidB);
  let thread = dmThreads.get(threadId);
  if (!thread) {
    thread = { threadId, members: [sidA, sidB], messages: [], lastAt: Date.now() };
    dmThreads.set(threadId, thread);
  }
  return thread;
}
function isDmMember(thread, sessionId) {
  return thread && thread.members.includes(sessionId);
}
function publicDmMessage(m, viewerSessionId) {
  return {
    id: m.id, threadId: m.threadId, senderSessionId: m.senderSessionId,
    senderName: m.senderName, content: m.content, createdAt: m.createdAt,
    mine: m.senderSessionId === viewerSessionId,
  };
}
function broadcastDmMessage(thread, msg) {
  for (const sid of thread.members) {
    const socketId = findSocketBySession(sid);
    if (!socketId) continue;
    io.to(socketId).emit("dm:message", publicDmMessage(msg, sid));
  }
}

// ---------- graceful removal ----------
function removeFromRoom(roomId, sessionId, reason = "left", kickerName = null) {
  console.log(`[v20.6] removeFromRoom: ${sessionId} reason=${reason} room=${roomId}`);
  const room = rooms.get(roomId);
  if (!room || room.status !== "active") return;

  const p = room.participants.find((x) => x.sessionId === sessionId);
  if (!p) return;

  const wasAdmin = room.admin === sessionId;
  const wasHost = room.host === sessionId;

  room.participants = room.participants.filter((x) => x.sessionId !== sessionId);
  room.timeouts.delete(sessionId);
  room.lastMessageAt.delete(sessionId);
  sessionRooms.delete(sessionId);

  const sid = findSocketBySession(sessionId);
  if (sid) {
    const s = sessions.get(sid);
    if (s) s.status = "available";
    const sock = io.sockets.sockets.get(sid);
    if (sock && reason !== "kicked") sock.leave(roomId);
  }

  if (reason === "kicked" && kickerName) {
    broadcastRoomSystem(room, { type: "kick", username: p.username, by: kickerName });
  } else if (reason === "left" || reason === "disconnected") {
    broadcastRoomSystem(room, { type: "leave", username: p.username });
  }

  if (room.participants.length === 0) {
    room.status = "closed";
    rooms.delete(roomId);
    const socketsInRoom = io.sockets.adapter.rooms.get(roomId);
    if (socketsInRoom) for (const sid2 of socketsInRoom) io.sockets.sockets.get(sid2)?.leave(roomId);
    broadcastOnline();
    return;
  }

  if (wasAdmin) {
    const newAdmin = room.participants[0];
    if (newAdmin) {
      room.admin = newAdmin.sessionId;
      broadcastRoomSystem(room, { type: "transfer", from: p.username, to: newAdmin.username });
    }
  }
  if (wasHost) {
    const newHost = room.participants[0];
    if (newHost) room.host = newHost.sessionId;
  }

  broadcastRoomUpdate(room);
  broadcastOnline();
}

// ---------- close room ----------
function closeRoom(roomId, reason) {
  const room = rooms.get(roomId);
  if (!room || room.status !== "active") return;
  room.status = "closed";

  for (const p of room.participants) {
    sessionRooms.delete(p.sessionId);
    const sid = findSocketBySession(p.sessionId);
    if (sid) {
      const s = sessions.get(sid);
      if (s) s.status = "available";
    }
  }

  io.to(roomId).emit("room:ended", {
    roomId,
    reason: reason === "disconnected"
      ? "The other participant has disconnected."
      : "The other participant has left.",
  });

  const socketsInRoom = io.sockets.adapter.rooms.get(roomId);
  if (socketsInRoom) for (const sid of socketsInRoom) io.sockets.sockets.get(sid)?.leave(roomId);

  rooms.delete(roomId);
  broadcastOnline();
}

// ---------- initialize SQLite + reload persisted strikes ----------
db.init();
{
  const loaded = db.loadAllStrikes();
  for (const rec of loaded) {
    strikeRecords.set(rec.spamKey, {
      count: rec.count,
      level: rec.level,
      lastOffense: rec.lastOffense,
      cooldownUntil: rec.cooldownUntil,
      shadowBannedUntil: rec.shadowBannedUntil,
      warningsShown: rec.warningsShown,
    });
  }
  console.log(`[db] reloaded ${loaded.length} strike record(s)`);
}

// ---------- connection ----------
io.on("connection", (socket) => {
  const provided = String(socket.handshake.auth?.username || "").trim();
  const validName = /^[A-Za-z]+\d{1,4}$/.test(provided) && provided.length <= 20 ? provided : null;

  const clientIp = getClientIp(socket);
  const spamKey = `ip:${clientIp}`;

  const session = {
    sessionId: makeId(),
    spamKey,
    ip: clientIp,
    username: validName || makeUsername(),
    accent: pick(ACCENTS),
    status: "available",
    blocked: new Map(),
  };
  sessions.set(socket.id, session);
  socketBySession.set(session.sessionId, socket.id);

  // v21.3 â€” log connection for 180-day retention (Rule 3(1)(h))
  db.logConnect(clientIp, session.sessionId, socket.handshake.headers["user-agent"] || "");

  socket.emit("session:ready", session);
  // v24.7 — global rate limit for sensitive actions
  const SENSITIVE_EVENTS = new Set([
    "room:kick", "room:purge", "room:set-lifetime", "room:set-topic",
    "room:set-slowmode", "room:clear-timeout", "room:transfer-admin",
    "room:timeout", "report:user", "block:user", "unblock:user", "user:rename"
  ]);
  socket.use((event, next) => {
    if (!Array.isArray(event)) return next();
    const name = event[0];
    if (!SENSITIVE_EVENTS.has(name)) return next();
    const s = sessions.get(socket.id);
    if (!s) return next();
    const limit = name === "report:user" ? 10 : 30;
    if (!rateLimit(`sens:${name}:${s.spamKey}`, limit, 60000)) {
      const ack = event[event.length - 1];
      if (typeof ack === "function") ack({ ok: false, error: "Slow down — too many requests." });
      return;
    }
    next();
  });
  broadcastOnline();
  broadcastSystemFor(session.sessionId, { type: "join", username: session.username });

  // ---------- room discovery ----------
  socket.on("room:list", (_payload, ack) => {
    const s = sessions.get(socket.id);
    if (!s) return ack?.({ ok: false, error: "No session" });
    const list = [];
    for (const room of rooms.values()) {
      if (room.status !== "active") continue;
      const adminSid = findSocketBySession(room.admin);
      const adminSession = adminSid ? sessions.get(adminSid) : null;
      list.push({
        roomId: room.roomId,
        topic: room.topic || "",
        adminName: adminSession?.username || "?",
        capacity: room.capacity,
        occupancy: room.participants.length,
        full: room.participants.length >= room.capacity,
        slowMode: room.slowMode,
        createdAt: room.createdAt,
      });
    }
    list.sort((a, b) => {
      if (a.full !== b.full) return a.full ? 1 : -1;
      return b.createdAt - a.createdAt;
    });
    ack?.({ ok: true, rooms: list });
  });

  // ---------- list pending invites for a room ----------
  socket.on("room:invites:list", ({ roomId } = {}, ack) => {
    const s = sessions.get(socket.id);
    if (!s) return ack?.({ ok: false, error: "No session" });
    const room = rooms.get(roomId);
    if (!room || room.status !== "active") return ack?.({ ok: false, error: "Room closed" });
    if (!room.participants.some((p) => p.sessionId === s.sessionId)) {
      return ack?.({ ok: false, error: "Not in this room" });
    }
    const list = [];
    for (const inv of invites.values()) {
      if (inv.roomId !== roomId) continue;
      list.push({
        inviteId: inv.inviteId,
        from: { sessionId: inv.senderSessionId, username: inv.senderName },
        recipientSessionId: inv.recipientSessionId,
        message: inv.message || "",
        createdAt: inv.createdAt,
      });
    }
    ack?.({ ok: true, invites: list });
  });

  // ---------- messages:since ----------
  socket.on("messages:since", ({ since } = {}, ack) => {
    const s = sessions.get(socket.id);
    if (!s) return ack?.({ ok: false, error: "No session" });
    const ts = Number(since) || 0;
    const now = Date.now();
    const out = [];
    for (const m of publicHistory) {
      if (m.createdAt <= ts) continue;
      if (m.senderSessionId === s.sessionId) continue;
      if (isShadowBanned(m.senderSpamKey)) continue;
      if (s.blocked.has(m.senderSessionId)) continue;
      if (isBlocked(m.senderSessionId, s.sessionId)) continue;
      out.push(m);
    }
    const awayFor = ts > 0 ? Math.max(0, now - ts) : 0;
    ack?.({ ok: true, messages: out, awayFor });
  });

  // ---------- public chat ----------
  socket.on("chat:public:send", ({ content, replyTo } = {}, ack) => {
    const s = sessions.get(socket.id);
    if (!s) return ack?.({ ok: false, error: "No session" });

    const text = clean(String(content ?? "").trim());
    if (!text) return ack?.({ ok: false, error: "Empty message" });
    if (text.length > MAX_MSG) return ack?.({ ok: false, error: "Message too long" });

    if (!rateLimit(`msg:${s.spamKey}`, RATE_MSG, 10000)) {
      return ack?.({ ok: false, error: "Slow down â€” too many messages." });
    }

    const msg = {
      id: makeId(),
      senderSessionId: s.sessionId,
      senderSpamKey: s.spamKey,
      senderName: s.username,
      content: text,
      createdAt: Date.now(),
      replyTo: sanitizeReply(replyTo),
    };
    messageOwners.set(msg.id, { senderSessionId: s.sessionId, roomId: null, createdAt: Date.now() });

    if (isShadowBanned(s.spamKey)) {
      io.to(socket.id).emit("chat:public:message", msg);
      return ack?.({ ok: true, id: msg.id });
    }

    const spam = checkSpam(s.spamKey, text, socket.id);
    if (spam.blocked) {
      if (spam.reason === "cooldown") {
        return ack?.({ ok: false, error: `Wait ${Math.ceil((spam.cooldownMs || 0) / 1000)}s.` });
      }
      const errors = {
        duplicate: "Duplicate message â€” please don't repeat.",
        burst: "Too fast â€” slow down.",
        links: "Too many links.",
        repetition: "Repetitive content detected.",
      };
      return ack?.({ ok: false, error: errors[spam.reason] || "Slow down." });
    }

    broadcastPublicMessage(msg);
    ack?.({ ok: true, id: msg.id });
  });

  // ---------- public image send (v21.2 spam check) ----------
  socket.on("chat:public:image", ({ image, caption, replyTo } = {}, ack) => {
    const s = sessions.get(socket.id);
    if (!s) return ack?.({ ok: false, error: "No session" });
    if (!rateLimit(`msg:${s.spamKey}`, RATE_MSG, 10000)) {
      return ack?.({ ok: false, error: "Slow down." });
    }
    if (!isImageData(image)) return ack?.({ ok: false, error: "Invalid image" });

    const cleanCaption = clean(String(caption || "").trim()).slice(0, 200);
    const msg = {
      id: makeId(),
      senderSessionId: s.sessionId,
      senderSpamKey: s.spamKey,
      senderName: s.username,
      content: cleanCaption,
      image,
      createdAt: Date.now(),
      replyTo: sanitizeReply(replyTo),
    };
    messageOwners.set(msg.id, { senderSessionId: s.sessionId, roomId: null, createdAt: Date.now() });

    if (isShadowBanned(s.spamKey)) {
      io.to(socket.id).emit("chat:public:message", msg);
      return ack?.({ ok: true, id: msg.id });
    }

    const spamContent = cleanCaption ? `${cleanCaption} [image]` : "[image]";
    const spam = checkSpam(s.spamKey, spamContent, socket.id);
    if (spam.blocked) {
      if (spam.reason === "cooldown") {
        return ack?.({ ok: false, error: `Wait ${Math.ceil((spam.cooldownMs || 0) / 1000)}s.` });
      }
      const errors = {
        duplicate: "Duplicate image â€” please don't repeat.",
        burst: "Too many images â€” slow down.",
        links: "Too many links.",
        repetition: "Repetitive image detected.",
      };
      return ack?.({ ok: false, error: errors[spam.reason] || "Slow down." });
    }

    broadcastPublicMessage(msg);
    ack?.({ ok: true, id: msg.id });
  });

  // ---------- typing ----------
  socket.on("typing:public", () => {
    const s = sessions.get(socket.id);
    if (!s) return;
    for (const [socketId, sess] of sessions) {
      if (sess.sessionId === s.sessionId) continue;
      if (sess.blocked.has(s.sessionId) || s.blocked.has(sess.sessionId)) continue;
      io.to(socketId).emit("typing:public", { sessionId: s.sessionId, username: s.username });
    }
  });
  socket.on("typing:room", ({ roomId } = {}) => {
    const s = sessions.get(socket.id);
    if (!s) return;
    const room = rooms.get(roomId);
    if (!room || room.status !== "active") return;
    if (!room.participants.some((p) => p.sessionId === s.sessionId)) return;
    for (const p of room.participants) {
      if (p.sessionId === s.sessionId) continue;
      if (isMutuallyBlocked(p.sessionId, s.sessionId)) continue;
      const sid = findSocketBySession(p.sessionId);
      if (sid) io.to(sid).emit("typing:room", { roomId, sessionId: s.sessionId, username: s.username });
    }
  });

  // ---------- rename ----------
  socket.on("user:rename", ({ username } = {}, ack) => {
    const s = sessions.get(socket.id);
    if (!s) return ack?.({ ok: false, error: "No session" });
    const name = String(username || "").trim();
    if (!/^[A-Za-z]+\d{1,4}$/.test(name) || name.length > 20) {
      return ack?.({ ok: false, error: "Invalid name" });
    }
    const old = s.username;
    s.username = name;
    socket.emit("session:ready", s);
    broadcastOnline();
    broadcastSystemFor(s.sessionId, { type: "rename", oldName: old, username: name });

    const roomId = sessionRooms.get(s.sessionId);
    if (roomId) {
      const room = rooms.get(roomId);
      if (room) {
        const p = room.participants.find((x) => x.sessionId === s.sessionId);
        if (p) p.username = name;
        broadcastRoomUpdate(room);
      }
    }
    ack?.({ ok: true, username: name });
  });

  // ---------- create room ----------
  socket.on("room:create", ({ capacity, topic } = {}, ack) => {
    const s = sessions.get(socket.id);
    if (!s) return ack?.({ ok: false, error: "No session" });
    if (sessionRooms.has(s.sessionId)) return ack?.({ ok: false, error: "You are already in a room" });
    if (!rateLimit(`room:${s.spamKey}`, RATE_ROOM, 60000)) {
      return ack?.({ ok: false, error: "Too many rooms. Try again in a minute." });
    }
    const cap = Number(capacity);
    if (!Number.isFinite(cap) || cap < MIN_ROOM_CAPACITY || cap > MAX_ROOM_CAPACITY) {
      return ack?.({ ok: false, error: `Room size must be ${MIN_ROOM_CAPACITY}-${MAX_ROOM_CAPACITY}` });
    }
    const cleanTopic = sanitizeTopic(topic);

    const roomId = makeId();
    const room = {
      roomId,
      host: s.sessionId,
      admin: s.sessionId,
      topic: cleanTopic,
      capacity: cap,
      slowMode: 0,
            messageLifetime: 0,
      participants: [{ sessionId: s.sessionId, username: s.username }],
      timeouts: new Map(),
      lastMessageAt: new Map(),
      createdAt: Date.now(),
      status: "active",
    };
    rooms.set(roomId, room);
    sessionRooms.set(s.sessionId, roomId);
    s.status = "in-room";
    socket.join(roomId);
    broadcastOnline();
    ack?.({ ok: true, room: publicRoom(room) });
  });

  // ---------- admin: set topic ----------
  socket.on("room:set-topic", ({ roomId, topic } = {}, ack) => {
    const s = sessions.get(socket.id);
    if (!s) return ack?.({ ok: false, error: "No session" });
    const room = rooms.get(roomId);
    if (!room || room.status !== "active") return ack?.({ ok: false, error: "Room closed" });
    if (!isRoomAdmin(room, s.sessionId)) return ack?.({ ok: false, error: "Not admin" });

    room.topic = sanitizeTopic(topic);
    broadcastRoomUpdate(room);
    broadcastRoomSystem(room, { type: "topic", username: s.username, topic: room.topic });
    ack?.({ ok: true, topic: room.topic });
  });

  // ---------- admin: set slow mode ----------
  socket.on("room:set-slowmode", ({ roomId, seconds } = {}, ack) => {
    const s = sessions.get(socket.id);
    if (!s) return ack?.({ ok: false, error: "No session" });
    const room = rooms.get(roomId);
    if (!room || room.status !== "active") return ack?.({ ok: false, error: "Room closed" });
    if (!isRoomAdmin(room, s.sessionId)) return ack?.({ ok: false, error: "Not admin" });

    const sec = Number(seconds);
    if (!SLOW_MODE_OPTIONS_SEC.includes(sec)) return ack?.({ ok: false, error: "Invalid slow mode" });

    room.slowMode = sec;
    broadcastRoomUpdate(room);
    broadcastRoomSystem(room, { type: "slowmode", username: s.username, seconds: sec });
    ack?.({ ok: true, slowMode: sec });
  });
  // ---------- v24: message lifetime ----------
  socket.on("room:set-lifetime", ({ roomId, seconds } = {}, ack) => {
    const s = sessions.get(socket.id);
    if (!s) return ack?.({ ok: false, error: "No session" });
    const room = rooms.get(roomId);
    if (!room || room.status !== "active") return ack?.({ ok: false, error: "Room closed" });
    if (!isRoomAdmin(room, s.sessionId)) return ack?.({ ok: false, error: "Not admin" });

    const allowed = [0, 300, 1800, 3600, 21600, 86400];
    const sec = Number(seconds);
    if (!allowed.includes(sec)) return ack?.({ ok: false, error: "Invalid lifetime" });

    room.messageLifetime = sec;
    broadcastRoomUpdate(room);
    broadcastRoomSystem(room, { type: "lifetime", username: s.username, seconds: sec });

    for (const p of room.participants) {
      const sid = findSocketBySession(p.sessionId);
      if (sid) io.to(sid).emit("room:lifetime-update", { roomId: room.roomId, seconds: sec });
    }
    ack?.({ ok: true, seconds: sec });
  });

  // ---------- v24: purge room chat ----------
  socket.on("room:purge", ({ roomId } = {}, ack) => {
    const s = sessions.get(socket.id);
    if (!s) return ack?.({ ok: false, error: "No session" });
    const room = rooms.get(roomId);
    if (!room || room.status !== "active") return ack?.({ ok: false, error: "Room closed" });
    if (!isRoomAdmin(room, s.sessionId)) return ack?.({ ok: false, error: "Not admin" });

    for (const [mid, meta] of messageOwners) {
      if (meta.roomId === roomId) messageOwners.delete(mid);
    }

    for (const p of room.participants) {
      const sid = findSocketBySession(p.sessionId);
      if (sid) io.to(sid).emit("room:purged", { roomId: room.roomId, by: s.username });
    }

    broadcastRoomSystem(room, { type: "purge", username: s.username, by: s.username });
    console.log(`[v24] room ${roomId} purged by ${s.username}`);
    ack?.({ ok: true });
  });

  // ---------- admin: kick ----------
  socket.on("room:kick", ({ roomId, targetSessionId } = {}, ack) => {
    const s = sessions.get(socket.id);
    if (!s) return ack?.({ ok: false, error: "No session" });
    const room = rooms.get(roomId);
    if (!room || room.status !== "active") return ack?.({ ok: false, error: "Room closed" });
    if (!isRoomAdmin(room, s.sessionId)) return ack?.({ ok: false, error: "Not admin" });

    const target = String(targetSessionId || "");
    if (!target || target === s.sessionId) return ack?.({ ok: false, error: "Invalid target" });

    const p = room.participants.find((x) => x.sessionId === target);
    if (!p) return ack?.({ ok: false, error: "Not in this room" });

    const targetSid = findSocketBySession(target);
    if (targetSid) io.to(targetSid).emit("room:kicked", { roomId, by: s.username });

    removeFromRoom(roomId, target, "kicked", s.username);
    ack?.({ ok: true });
  });

  // ---------- admin: timeout ----------
  socket.on("room:timeout", ({ roomId, targetSessionId, durationMs } = {}, ack) => {
    const s = sessions.get(socket.id);
    if (!s) return ack?.({ ok: false, error: "No session" });
    const room = rooms.get(roomId);
    if (!room || room.status !== "active") return ack?.({ ok: false, error: "Room closed" });
    if (!isRoomAdmin(room, s.sessionId)) return ack?.({ ok: false, error: "Not admin" });

    const target = String(targetSessionId || "");
    if (!target || target === s.sessionId) return ack?.({ ok: false, error: "Invalid target" });

    const dur = Number(durationMs);
    if (!TIMEOUT_OPTIONS_MS.includes(dur)) return ack?.({ ok: false, error: "Invalid duration" });

    const p = room.participants.find((x) => x.sessionId === target);
    if (!p) return ack?.({ ok: false, error: "Not in this room" });

    room.timeouts.set(target, Date.now() + dur);
    broadcastRoomSystem(room, {
      type: "timeout",
      username: p.username,
      by: s.username,
      durationMs: dur,
    });
    broadcastRoomUpdate(room);
    ack?.({ ok: true, until: room.timeouts.get(target) });
  });

  // ---------- admin: clear timeout ----------
  socket.on("room:clear-timeout", ({ roomId, targetSessionId } = {}, ack) => {
    const s = sessions.get(socket.id);
    if (!s) return ack?.({ ok: false, error: "No session" });
    const room = rooms.get(roomId);
    if (!room || room.status !== "active") return ack?.({ ok: false, error: "Room closed" });
    if (!isRoomAdmin(room, s.sessionId)) return ack?.({ ok: false, error: "Not admin" });
    const target = String(targetSessionId || "");
    room.timeouts.delete(target);
    broadcastRoomUpdate(room);
    broadcastRoomSystem(room, { type: "untimeout", by: s.username });
    ack?.({ ok: true });
  });

  // ---------- admin: transfer admin ----------
  socket.on("room:transfer-admin", ({ roomId, targetSessionId } = {}, ack) => {
    const s = sessions.get(socket.id);
    if (!s) return ack?.({ ok: false, error: "No session" });
    const room = rooms.get(roomId);
    if (!room || room.status !== "active") return ack?.({ ok: false, error: "Room closed" });
    if (!isRoomAdmin(room, s.sessionId)) return ack?.({ ok: false, error: "Not admin" });

    const target = String(targetSessionId || "");
    if (!target || target === s.sessionId) return ack?.({ ok: false, error: "Invalid target" });

    const p = room.participants.find((x) => x.sessionId === target);
    if (!p) return ack?.({ ok: false, error: "Not in this room" });

    room.admin = target;
    broadcastRoomSystem(room, { type: "transfer", from: s.username, to: p.username });
    broadcastRoomUpdate(room);
    ack?.({ ok: true, admin: target });
  });

  
  // ---------- v22 â€” join room directly (from discovery list) ----------
  socket.on("room:join", ({ roomId } = {}, ack) => {
    const s = sessions.get(socket.id);
    if (!s) return ack?.({ ok: false, error: "No session" });
    if (sessionRooms.has(s.sessionId)) return ack?.({ ok: false, error: "You are already in a room" });

    const room = rooms.get(roomId);
    if (!room || room.status !== "active") return ack?.({ ok: false, error: "Room closed" });
    if (room.participants.length >= room.capacity) return ack?.({ ok: false, error: "Room is full" });

    for (const p of room.participants) {
      if (isMutuallyBlocked(p.sessionId, s.sessionId)) {
        return ack?.({ ok: false, error: "Unable to join this room" });
      }
    }

    room.participants.push({ sessionId: s.sessionId, username: s.username });
    sessionRooms.set(s.sessionId, room.roomId);
    s.status = "in-room";
    socket.join(room.roomId);
    broadcastRoomSystem(room, { type: "join", username: s.username });
    broadcastRoomUpdate(room);
    broadcastOnline();
    ack?.({ ok: true, room: publicRoom(room) });
  });
  // ---------- invite ----------
  socket.on("room:invite", ({ roomId, recipientUsername, message } = {}, ack) => {
    const s = sessions.get(socket.id);
    if (!s) return ack?.({ ok: false, error: "No session" });
    if (!rateLimit(`inv:${s.spamKey}`, RATE_INV, 60000)) {
      return ack?.({ ok: false, error: "Too many invitations." });
    }
    const room = rooms.get(roomId);
    if (!room || room.status !== "active") return ack?.({ ok: false, error: "Room closed" });
    if (!room.participants.some((p) => p.sessionId === s.sessionId)) {
      return ack?.({ ok: false, error: "Not in this room" });
    }
    if (room.participants.length >= room.capacity) {
      return ack?.({ ok: false, error: "Your room is full" });
    }
    const cleanName = String(recipientUsername || "").trim();
    let found = null;
    for (const u of sessions.values()) {
      if (u.sessionId === s.sessionId) continue;
      if (u.username.toLowerCase() === cleanName.toLowerCase()) { found = u; break; }
    }
    if (!found) return ack?.({ ok: false, error: "User is offline or not found" });
    if (sessionRooms.has(found.sessionId)) return ack?.({ ok: false, error: "That user is already in a room" });
    if (s.blocked.has(found.sessionId) || found.blocked.has(s.sessionId)) {
      return ack?.({ ok: false, error: "Unable to send invitation." });
    }
    const targetSocketId = findSocketBySession(found.sessionId);
    if (!targetSocketId) return ack?.({ ok: false, error: "User is offline" });

    for (const inv of invites.values()) {
      if (inv.recipientSessionId === found.sessionId && inv.roomId === roomId) {
        return ack?.({ ok: false, error: "Invite already sent" });
      }
    }

    const inviteId = makeId();
    invites.set(inviteId, {
      inviteId,
      senderSessionId: s.sessionId,
      senderName: s.username,
      recipientSessionId: found.sessionId,
      roomId,
      message: clean(String(message || "")).trim().slice(0, 200),
      createdAt: Date.now(),
    });
    io.to(targetSocketId).emit("invite:received", {
      inviteId,
      from: { sessionId: s.sessionId, username: s.username },
      roomTopic: room.topic,
      capacity: room.capacity,
      occupancy: room.participants.length,
      message: clean(String(message || "")).trim().slice(0, 200),
    });

    const inviteMessage = clean(String(message || "")).trim().slice(0, 200);
    for (const p of room.participants) {
      if (p.sessionId === s.sessionId) continue;
      const sid = findSocketBySession(p.sessionId);
      if (sid) {
        io.to(sid).emit("room:invite:pending", {
          inviteId,
          from: { sessionId: s.sessionId, username: s.username },
          recipientSessionId: found.sessionId,
          recipientUsername: found.username,
          roomId,
          message: inviteMessage,
          at: Date.now(),
        });
      }
    }

    ack?.({ ok: true, inviteId });
  });

  socket.on("invite:accept", ({ inviteId } = {}, ack) => {
    const s = sessions.get(socket.id);
    if (!s) return ack?.({ ok: false, error: "No session" });
    const inv = invites.get(inviteId);
    if (!inv) return ack?.({ ok: false, error: "Invitation expired" });
    if (inv.recipientSessionId !== s.sessionId) return ack?.({ ok: false, error: "Not your invitation" });
    invites.delete(inviteId);

    const room = rooms.get(inv.roomId);
    if (!room || room.status !== "active") return ack?.({ ok: false, error: "Room is no longer available" });
    if (room.participants.length >= room.capacity) return ack?.({ ok: false, error: "Room is full" });
    if (sessionRooms.has(s.sessionId)) return ack?.({ ok: false, error: "You are already in a room" });

    room.participants.push({ sessionId: s.sessionId, username: s.username });
    sessionRooms.set(s.sessionId, room.roomId);
    s.status = "in-room";
    socket.join(room.roomId);
    broadcastRoomSystem(room, { type: "join", username: s.username });
    broadcastRoomUpdate(room);

    for (const p of room.participants) {
      const sid = findSocketBySession(p.sessionId);
      if (sid) io.to(sid).emit("room:invite:resolved", {
        inviteId,
        accepted: true,
        joinedUsername: s.username,
        at: Date.now(),
      });
    }

    broadcastOnline();
    ack?.({ ok: true, room: publicRoom(room) });
  });

  socket.on("invite:decline", ({ inviteId } = {}) => {
    const inv = invites.get(inviteId);
    if (!inv) return;
    invites.delete(inviteId);
    const sid = findSocketBySession(inv.senderSessionId);
    if (sid) io.to(sid).emit("invite:declined", { inviteId });

    const room = rooms.get(inv.roomId);
    if (room && room.status === "active") {
      for (const p of room.participants) {
        const psid = findSocketBySession(p.sessionId);
        if (psid) io.to(psid).emit("room:invite:resolved", {
          inviteId,
          accepted: false,
          at: Date.now(),
        });
      }
    }
  });

  // ---------- room message ----------
  socket.on("room:message", ({ roomId, content, replyTo } = {}, ack) => {
    const s = sessions.get(socket.id);
    if (!s) return ack?.({ ok: false, error: "No session" });

    const room = rooms.get(roomId);
    if (!room || room.status !== "active") return ack?.({ ok: false, error: "Room closed" });
    if (!room.participants.some((p) => p.sessionId === s.sessionId)) {
      return ack?.({ ok: false, error: "Not in this room" });
    }

    const timeoutLeft = roomTimeoutRemaining(room, s.sessionId);
    if (timeoutLeft > 0) {
      return ack?.({
        ok: false,
        error: `You are timed out for ${Math.ceil(timeoutLeft / 1000)}s.`,
        timeoutMs: timeoutLeft,
      });
    }

    const slowLeft = roomSlowModeRemaining(room, s.sessionId);
    if (slowLeft > 0) {
      return ack?.({
        ok: false,
        error: `Slow mode: wait ${Math.ceil(slowLeft / 1000)}s.`,
        slowModeMs: slowLeft,
      });
    }

    const text = clean(String(content ?? "").trim());
    if (!text) return ack?.({ ok: false, error: "Empty" });
    if (text.length > MAX_MSG) return ack?.({ ok: false, error: "Too long" });

    if (!rateLimit(`msg:${s.spamKey}`, RATE_MSG, 10000)) {
      return ack?.({ ok: false, error: "Slow down." });
    }

    const msg = {
      id: makeId(),
      senderSessionId: s.sessionId,
      senderSpamKey: s.spamKey,
      senderName: s.username,
      content: text,
      createdAt: Date.now(),
      replyTo: sanitizeReply(replyTo),
    };
    messageOwners.set(msg.id, { senderSessionId: s.sessionId, roomId, createdAt: Date.now() });

    if (isShadowBanned(s.spamKey)) {
      const sid = findSocketBySession(s.sessionId);
      if (sid) io.to(sid).emit("room:message", msg);
      return ack?.({ ok: true, id: msg.id });
    }

    const spam = checkSpam(s.spamKey, text, socket.id);
    if (spam.blocked) {
      if (spam.reason === "cooldown") {
        return ack?.({ ok: false, error: `Wait ${Math.ceil((spam.cooldownMs || 0) / 1000)}s.` });
      }
      const errors = {
        duplicate: "Duplicate message.",
        burst: "Too fast.",
        links: "Too many links.",
        repetition: "Repetitive content.",
      };
      return ack?.({ ok: false, error: errors[spam.reason] || "Slow down." });
    }

    room.lastMessageAt.set(s.sessionId, Date.now());
    broadcastRoomMessage(room, msg);
    ack?.({ ok: true, id: msg.id });
  });

  // ---------- room image send (v21.2 spam check) ----------
  socket.on("room:image", ({ roomId, image, caption, replyTo } = {}, ack) => {
    const s = sessions.get(socket.id);
    if (!s) return ack?.({ ok: false, error: "No session" });
    if (!rateLimit(`msg:${s.spamKey}`, RATE_MSG, 10000)) {
      return ack?.({ ok: false, error: "Slow down." });
    }
    const room = rooms.get(roomId);
    if (!room || room.status !== "active") return ack?.({ ok: false, error: "Room closed" });
    if (!room.participants.some((p) => p.sessionId === s.sessionId)) {
      return ack?.({ ok: false, error: "Not in this room" });
    }

    const timeoutLeft = roomTimeoutRemaining(room, s.sessionId);
    if (timeoutLeft > 0) {
      return ack?.({ ok: false, error: `You are timed out for ${Math.ceil(timeoutLeft / 1000)}s.` });
    }
    const slowLeft = roomSlowModeRemaining(room, s.sessionId);
    if (slowLeft > 0) {
      return ack?.({ ok: false, error: `Slow mode: wait ${Math.ceil(slowLeft / 1000)}s.` });
    }

    if (!isImageData(image)) return ack?.({ ok: false, error: "Invalid image" });

    const cleanCaption = clean(String(caption || "").trim()).slice(0, 200);
    const msg = {
      id: makeId(),
      senderSessionId: s.sessionId,
      senderSpamKey: s.spamKey,
      senderName: s.username,
      content: cleanCaption,
      image,
      createdAt: Date.now(),
      replyTo: sanitizeReply(replyTo),
    };
    messageOwners.set(msg.id, { senderSessionId: s.sessionId, roomId, createdAt: Date.now() });

    if (isShadowBanned(s.spamKey)) {
      const sid = findSocketBySession(s.sessionId);
      if (sid) io.to(sid).emit("room:message", msg);
      return ack?.({ ok: true, id: msg.id });
    }

    const spamContent = cleanCaption ? `${cleanCaption} [image]` : "[image]";
    const spam = checkSpam(s.spamKey, spamContent, socket.id);
    if (spam.blocked) {
      if (spam.reason === "cooldown") {
        return ack?.({ ok: false, error: `Wait ${Math.ceil((spam.cooldownMs || 0) / 1000)}s.` });
      }
      const errors = {
        duplicate: "Duplicate image.",
        burst: "Too many images.",
        links: "Too many links.",
        repetition: "Repetitive image.",
      };
      return ack?.({ ok: false, error: errors[spam.reason] || "Slow down." });
    }

    room.lastMessageAt.set(s.sessionId, Date.now());
    broadcastRoomMessage(room, msg);
    ack?.({ ok: true, id: msg.id });
  });

  // ---------- reactions ----------
  socket.on("reaction:toggle", ({ messageId, emoji, roomId } = {}, ack) => {
    const s = sessions.get(socket.id);
    if (!s) return ack?.({ ok: false, error: "No session" });
    if (!messageId || !emoji) return ack?.({ ok: false, error: "Missing fields" });
    if (!rateLimit(`react:${s.spamKey}`, REACTION_RATE, 10000)) {
      return ack?.({ ok: false, error: "Slow down." });
    }
    if (!isEmoji(emoji)) return ack?.({ ok: false, error: "Invalid emoji" });

    if (roomId) {
      const room = rooms.get(roomId);
      if (!room || room.status !== "active") return ack?.({ ok: false, error: "Room closed" });
      if (!room.participants.some((p) => p.sessionId === s.sessionId)) {
        return ack?.({ ok: false, error: "Not in this room" });
      }
    }

    let m = reactions.get(messageId);
    if (!m) { m = new Map(); reactions.set(messageId, m); }
    reactionTimes.set(messageId, Date.now());

    let set = m.get(emoji);
    if (!set) { set = new Set(); m.set(emoji, set); }

    if (set.has(s.sessionId)) {
      set.delete(s.sessionId);
      if (set.size === 0) m.delete(emoji);
      if (m.size === 0) { reactions.delete(messageId); reactionTimes.delete(messageId); }
    } else {
      set.add(s.sessionId);
    }

    if (roomId) {
      const room = rooms.get(roomId);
      for (const p of room.participants) {
        if (isMutuallyBlocked(p.sessionId, s.sessionId)) continue;
        const sid = findSocketBySession(p.sessionId);
        if (!sid) continue;
        io.to(sid).emit("reaction:update", {
          messageId,
          reactions: getReactionsFor(messageId, p.sessionId),
        });
      }
    } else {
      broadcastReactionPublic(messageId, s.sessionId);
    }
    ack?.({ ok: true });
  });

  // ---------- edit message ----------
  socket.on("message:edit", ({ messageId, content, roomId } = {}, ack) => {
    const s = sessions.get(socket.id);
    if (!s) return ack?.({ ok: false, error: "No session" });
    if (!messageId) return ack?.({ ok: false, error: "Missing id" });
    const meta = messageOwners.get(String(messageId));
    if (!meta) return ack?.({ ok: false, error: "Message not found" });
    if (meta.senderSessionId !== s.sessionId) return ack?.({ ok: false, error: "Not your message" });
    const text = clean(String(content ?? "").trim());
    if (!text) return ack?.({ ok: false, error: "Empty" });
    if (text.length > MAX_MSG) return ack?.({ ok: false, error: "Too long" });

    const payload = { messageId: String(messageId), content: text, editedAt: Date.now() };

    if (meta.roomId) {
      const room = rooms.get(meta.roomId);
      if (room && room.status === "active") {
        for (const p of room.participants) {
          if (isMutuallyBlocked(p.sessionId, s.sessionId)) continue;
          const sid = findSocketBySession(p.sessionId);
          if (sid) io.to(sid).emit("message:edited", payload);
        }
      }
    } else {
      for (const [socketId, sess] of sessions) {
        if (sess.sessionId !== s.sessionId && (sess.blocked.has(s.sessionId) || isBlocked(s.sessionId, sess.sessionId))) continue;
        io.to(socketId).emit("message:edited", payload);
      }
    }
    ack?.({ ok: true });
  });

  // ---------- delete message ----------
  socket.on("message:delete", ({ messageId, roomId } = {}, ack) => {
    const s = sessions.get(socket.id);
    if (!s) return ack?.({ ok: false, error: "No session" });
    if (!messageId) return ack?.({ ok: false, error: "Missing id" });
    const meta = messageOwners.get(String(messageId));
    if (!meta) return ack?.({ ok: false, error: "Message not found" });
    if (meta.senderSessionId !== s.sessionId) return ack?.({ ok: false, error: "Not your message" });
    messageOwners.delete(String(messageId));

    const payload = { messageId: String(messageId) };

    if (meta.roomId) {
      const room = rooms.get(meta.roomId);
      if (room && room.status === "active") {
        for (const p of room.participants) {
          if (isMutuallyBlocked(p.sessionId, s.sessionId)) continue;
          const sid = findSocketBySession(p.sessionId);
          if (sid) io.to(sid).emit("message:deleted", payload);
        }
      }
    } else {
      for (const [socketId, sess] of sessions) {
        if (sess.sessionId !== s.sessionId && (sess.blocked.has(s.sessionId) || isBlocked(s.sessionId, sess.sessionId))) continue;
        io.to(socketId).emit("message:deleted", payload);
      }
    }
    ack?.({ ok: true });
  });

  // ---------- DM: open thread ----------
  socket.on("dm:open", ({ targetSessionId } = {}, ack) => {
    const s = sessions.get(socket.id);
    if (!s) return ack?.({ ok: false, error: "No session" });
    const target = String(targetSessionId || "");
    if (!target || target === s.sessionId) return ack?.({ ok: false, error: "Invalid target" });

    const targetSocketId = findSocketBySession(target);
    if (!targetSocketId) return ack?.({ ok: false, error: "User is offline" });
    const targetSession = sessions.get(targetSocketId);
    if (!targetSession) return ack?.({ ok: false, error: "User offline" });

    if (s.blocked.has(target) || targetSession.blocked.has(s.sessionId)) {
      return ack?.({ ok: false, error: "Cannot message this user" });
    }

    const thread = getOrCreateDmThread(s.sessionId, target);
    thread.lastAt = Date.now();

    const messages = thread.messages.map((m) => publicDmMessage(m, s.sessionId));

    ack?.({
      ok: true,
      thread: {
        threadId: thread.threadId,
        members: [
          { sessionId: s.sessionId, username: s.username },
          { sessionId: targetSession.sessionId, username: targetSession.username },
        ],
        messages,
      },
    });
  });

  // ---------- DM: send message ----------
  socket.on("dm:send", ({ threadId, content, replyTo } = {}, ack) => {
    const s = sessions.get(socket.id);
    if (!s) return ack?.({ ok: false, error: "No session" });
    const thread = dmThreads.get(String(threadId || ""));
    if (!thread) return ack?.({ ok: false, error: "Thread expired" });
    if (!isDmMember(thread, s.sessionId)) return ack?.({ ok: false, error: "Not a member" });

    const text = clean(String(content ?? "").trim());
    if (!text) return ack?.({ ok: false, error: "Empty" });
    if (text.length > MAX_MSG) return ack?.({ ok: false, error: "Too long" });

    if (!rateLimit(`dm:${s.spamKey}`, RATE_MSG, 10000)) {
      return ack?.({ ok: false, error: "Slow down." });
    }

    const spam = checkSpam(s.spamKey, text, socket.id);
    if (spam.blocked) {
      if (spam.reason === "cooldown") {
        return ack?.({ ok: false, error: `Wait ${Math.ceil((spam.cooldownMs || 0) / 1000)}s.` });
      }
      const errors = {
        duplicate: "Duplicate message.",
        burst: "Too fast.",
        links: "Too many links.",
        repetition: "Repetitive content.",
      };
      return ack?.({ ok: false, error: errors[spam.reason] || "Slow down." });
    }

    const msg = {
      id: makeId(),
      threadId: thread.threadId,
      senderSessionId: s.sessionId,
      senderName: s.username,
      content: text,
      createdAt: Date.now(),
      replyTo: sanitizeReply(replyTo),
    };

    thread.messages.push(msg);
    if (thread.messages.length > DM_MAX_MESSAGES) {
      thread.messages.splice(0, thread.messages.length - DM_MAX_MESSAGES);
    }
    thread.lastAt = Date.now();

    broadcastDmMessage(thread, msg);
    ack?.({ ok: true, id: msg.id });
  });

  // ---------- DM: typing ----------
  socket.on("dm:typing", ({ threadId } = {}) => {
    const s = sessions.get(socket.id);
    if (!s) return;
    const thread = dmThreads.get(String(threadId || ""));
    if (!thread || !isDmMember(thread, s.sessionId)) return;
    for (const sid of thread.members) {
      if (sid === s.sessionId) continue;
      const targetSocketId = findSocketBySession(sid);
      if (targetSocketId) {
        io.to(targetSocketId).emit("dm:typing", {
          threadId: thread.threadId,
          sessionId: s.sessionId,
          username: s.username,
        });
      }
    }
  });

  // ---------- DM: close thread ----------
  socket.on("dm:close", ({ threadId } = {}, ack) => {
    ack?.({ ok: true });
  });

  // ---------- report ----------
  socket.on("report:user", ({ targetSessionId, targetUsername, reason } = {}, ack) => {
    const s = sessions.get(socket.id);
    if (!s) return ack?.({ ok: false, error: "No session" });
    const report = {
      id: makeId(),
      reporter: s.sessionId,
      target: String(targetSessionId || ""),
      targetUsername: clean(String(targetUsername || "")).slice(0, 40),
      reason: clean(String(reason || "")).slice(0, 500),
      createdAt: Date.now(),
    };
    reports.push(report);
    if (reports.length > 100) reports.shift();
    db.saveReport(report);
    ack?.({ ok: true });
  });

  // ---------- block / unblock / list ----------
  socket.on("block:user", ({ targetSessionId, targetUsername } = {}, ack) => {
    const s = sessions.get(socket.id);
    if (!s) return ack?.({ ok: false, error: "No session" });
    if (!targetSessionId || targetSessionId === s.sessionId) {
      return ack?.({ ok: false, error: "Invalid target" });
    }
    s.blocked.set(String(targetSessionId), String(targetUsername || "unknown"));

    const roomId = sessionRooms.get(s.sessionId);
    if (roomId) {
      const room = rooms.get(roomId);
      if (room && room.participants.some((p) => p.sessionId === String(targetSessionId))) {
        removeFromRoom(roomId, s.sessionId, "left");
      }
    }

    broadcastOnline();
    ack?.({ ok: true });
  });

  socket.on("unblock:user", ({ targetSessionId } = {}, ack) => {
    const s = sessions.get(socket.id);
    if (!s) return ack?.({ ok: false, error: "No session" });
    s.blocked.delete(String(targetSessionId));
    broadcastOnline();
    ack?.({ ok: true });
  });

  socket.on("blocked:list", (_payload, ack) => {
    const s = sessions.get(socket.id);
    if (!s) return ack?.({ ok: false, error: "No session" });
    const list = [...s.blocked.entries()].map(([sessionId, username]) => ({ sessionId, username }));
    ack?.({ ok: true, blocked: list });
  });

  // ---------- leave ----------
  socket.on("room:leave", ({ roomId } = {}) => {
    const s = sessions.get(socket.id);
    if (!s) return;
    const room = rooms.get(roomId);
    if (!room) return;
    if (!room.participants.some((p) => p.sessionId === s.sessionId)) return;
    removeFromRoom(roomId, s.sessionId, "left");
  });

  // ---------- disconnect ----------
  socket.on("disconnect", () => {
    const s = sessions.get(socket.id);
    if (!s) return;
    const roomId = sessionRooms.get(s.sessionId);
    if (roomId) removeFromRoom(roomId, s.sessionId, "disconnected");
    sessions.delete(socket.id);
    socketBySession.delete(s.sessionId);

    // v21.3 â€” mark session as disconnected in retention log
    db.logDisconnect(s.sessionId);

    const removedInvites = [];
    for (const [inviteId, inv] of invites) {
      if (inv.senderSessionId === s.sessionId || inv.recipientSessionId === s.sessionId) {
        removedInvites.push(inv);
        invites.delete(inviteId);
      }
    }
    for (const inv of removedInvites) {
      const room = rooms.get(inv.roomId);
      if (room && room.status === "active") {
        for (const p of room.participants) {
          const psid = findSocketBySession(p.sessionId);
          if (psid) io.to(psid).emit("room:invite:resolved", {
            inviteId: inv.inviteId,
            accepted: false,
            reason: "offline",
            at: Date.now(),
          });
        }
      }
    }

    broadcastOnline();
    broadcastSystemFor(s.sessionId, { type: "leave", username: s.username });
  });
});

// ---------- get LAN IPs ----------
function getLanIps() {
  const list = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        list.push({ name, address: iface.address });
      }
    }
  }
  return list;
}

// ---------- listen on ALL interfaces ----------
const port = process.env.PORT || 4000;
// ---------- v25: AI BOT FLEET ----------
const { BOT_PROFILES, generateBotMessage, getBotByName } = require("./bots");

const BOT_ACTIVITY = {
  enabled: process.env.ENABLE_BOTS !== "false",
  intervalMs: 15000,
  activeBots: new Map(),
  lastCall: 0,
  minInterval: 6000
};

function initBots() {
  if (!BOT_ACTIVITY.enabled) {
    console.log("[bots] disabled via ENABLE_BOTS=false");
    return;
  }
  for (const profile of BOT_PROFILES) {
    const sessionId = "bot_" + profile.name;
    const spamKey = "bot:" + profile.name;
    sessions.set(sessionId, {
      sessionId,
      spamKey,
      ip: "bot",
      username: profile.name,
      accent: "#ff2d55",
      status: "available",
      blocked: new Map(),
      isBot: true
    });
    socketBySession.set(sessionId, null);
    BOT_ACTIVITY.activeBots.set(sessionId, profile);
  }
  console.log("[bots] " + BOT_ACTIVITY.activeBots.size + " bots initialized");
  setInterval(botTick, BOT_ACTIVITY.intervalMs);
  setTimeout(botPublicChat, 4000);
}

async function botTick() {
  if (!BOT_ACTIVITY.enabled) return;
  await botPublicChat();

  for (const room of rooms.values()) {
    if (room.status !== "active") continue;
    const botMembers = room.participants.filter(p => p.sessionId.startsWith("bot_"));
    if (botMembers.length === 0) continue;
    if (Math.random() > 0.3) continue;

    const bot = botMembers[Math.floor(Math.random() * botMembers.length)];
    const profile = getBotByName(bot.username);
    if (!profile) continue;

    const lastMsg = (room.messages || []).slice().reverse().find(m => !m.isBot);
    const lastContent = lastMsg ? lastMsg.content : null;

    try {
      const content = await generateBotMessage(profile, {
        topic: room.topic,
        lastMessage: lastContent,
        roomType: "public"
      });
      const msg = {
        id: "bot_" + Math.random().toString(36).slice(2, 10),
        senderSessionId: bot.sessionId,
        senderSpamKey: bot.spamKey,
        senderName: bot.username,
        content,
        createdAt: Date.now(),
        isBot: true
      };
      if (!room.messages) room.messages = [];
      room.messages.push(msg);
      if (room.messages.length > 200) room.messages.shift();
      broadcastRoomMessage(room, msg);
    } catch (e) {
      console.error("[bots] private reply failed:", e.message);
    }
  }

  if (Math.random() < 0.15) botJoinRoom();
  if (Math.random() < 0.05) botCreateRoom();
}

async function botPublicChat() {
  const now = Date.now();
  if (now - BOT_ACTIVITY.lastCall < BOT_ACTIVITY.minInterval) return;
  if (Math.random() > 0.4) return;

  const activeBots = Array.from(BOT_ACTIVITY.activeBots.values());
  if (activeBots.length === 0) return;

  const n = Math.min(2, 1 + Math.floor(Math.random() * 2));

  for (let i = 0; i < n; i++) {
    const profile = activeBots[Math.floor(Math.random() * activeBots.length)];
    try {
      const content = await generateBotMessage(profile, {
        roomType: "public",
        lastMessage: publicHistory.length > 0
          ? publicHistory[publicHistory.length - 1].content
          : null
      });
      const msg = {
        id: "bot_" + Math.random().toString(36).slice(2, 10),
        senderSessionId: "bot_" + profile.name,
        senderSpamKey: "bot:" + profile.name,
        senderName: profile.name,
        content,
        createdAt: Date.now(),
        isBot: true
      };
      publicHistory.push(msg);
      if (publicHistory.length > PUBLIC_HISTORY_MAX) publicHistory.shift();

      for (const [socketId, session] of sessions) {
        if (!session.isBot) io.to(socketId).emit("chat:public:message", msg);
      }
      BOT_ACTIVITY.lastCall = Date.now();
    } catch (e) {
      console.error("[bots] public chat failed:", e.message);
    }
  }
}

function botJoinRoom() {
  const openRooms = Array.from(rooms.values()).filter(r =>
    r.status === "active" &&
    r.participants.length < r.capacity &&
    r.participants.filter(p => p.sessionId.startsWith("bot_")).length < 2
  );
  if (openRooms.length === 0) return;

  const room = openRooms[Math.floor(Math.random() * openRooms.length)];
  const botsNotIn = Array.from(BOT_ACTIVITY.activeBots.values()).filter(
    p => !room.participants.some(x => x.sessionId === "bot_" + p.name)
  );
  if (botsNotIn.length === 0) return;

  const profile = botsNotIn[Math.floor(Math.random() * botsNotIn.length)];
  const botSession = sessions.get("bot_" + profile.name);
  if (!botSession) return;

  room.participants.push({ sessionId: botSession.sessionId, username: botSession.username });
  broadcastRoomSystem(room, { type: "join", username: botSession.username });
  broadcastRoomUpdate(room);
  console.log("[bots] " + botSession.username + " joined " + room.roomId);
}

function botCreateRoom() {
  const openRooms = Array.from(rooms.values()).filter(r => r.status === "active");
  if (openRooms.length > 8) return;

  const profile = BOT_PROFILES[Math.floor(Math.random() * BOT_PROFILES.length)];
  const sessionId = "bot_" + profile.name;
  const session = sessions.get(sessionId);
  if (!session) return;

  for (const r of rooms.values()) {
    if (r.participants.some(p => p.sessionId === sessionId)) return;
  }

  const topics = ["3AM Thoughts", "Midnight Confessions", "Late Night Lounge", "Code Cave", "The Vent Room", "Quiet Corner", "Insomnia Club", "Dream Journal", "Random Chats"];
  const roomId = "botroom_" + Math.random().toString(36).slice(2, 8);
  const room = {
    roomId,
    host: sessionId,
    admin: sessionId,
    topic: topics[Math.floor(Math.random() * topics.length)],
    capacity: 6 + Math.floor(Math.random() * 4),
    slowMode: 0,
    messageLifetime: 3600,
    participants: [{ sessionId, username: profile.name }],
    timeouts: new Map(),
    lastMessageAt: new Map(),
    messages: [],
    createdAt: Date.now(),
    status: "active",
    isBotRoom: true
  };
  rooms.set(roomId, room);
  sessionRooms.set(sessionId, roomId);
  session.status = "in-room";
  console.log("[bots] " + profile.name + " created room: " + room.topic);
}

initBots();

server.listen(port, "0.0.0.0", () => {
  const ips = getLanIps();
  console.log("");
  console.log("  â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—");
  console.log("  â•‘  ANON// backend v21.2 â€” image spam + SQLite      â•‘");
  console.log("  â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•");
  console.log("");
  console.log(`  Laptop    â†’ http://localhost:${PORT}`);
  if (ips.length === 0) {
    console.log(`  Mobile    â†’ (no LAN IP detected â€” are you on Wi-Fi?)`);
  } else {
    for (const ip of ips) {
      console.log(`  Mobile    â†’ http://${ip.address}:${PORT}    (${ip.name})`);
    }
  }
  console.log("");
  console.log(`  CORS allowed: ${CLIENT_ORIGIN === "*" ? "any origin" : CLIENT_ORIGIN + " + localhost + private LAN"}`);
  console.log("");
});
