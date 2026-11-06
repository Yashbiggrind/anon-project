const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const net = require("node:net");
const path = require("node:path");
const fs = require("node:fs/promises");
const os = require("node:os");
const { io } = require("socket.io-client");

process.env.NODE_ENV = "test";
process.env.IP_HASH_SECRET = "anon-test-hmac-secret-with-at-least-32-characters";
const { hashIp } = require("../db");

function waitForEvent(socket, eventName, predicate = () => true, timeoutMs = 7000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, handler);
      reject(new Error("Timed out waiting for " + eventName));
    }, timeoutMs);
    const handler = (value) => {
      if (!predicate(value)) return;
      clearTimeout(timer);
      socket.off(eventName, handler);
      resolve(value);
    };
    socket.on(eventName, handler);
  });
}

function emitAck(socket, eventName, payload, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timed out waiting for ack: " + eventName)), timeoutMs);
    socket.emit(eventName, payload, (result) => {
      clearTimeout(timer);
      resolve(result);
    });
  });
}

async function getFreePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitForHttp(url, child, getOutput, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "server did not respond";
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error("Server exited early. " + getOutput());
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = "HTTP " + response.status;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Server startup failed: " + lastError + ". " + getOutput());
}

async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  // Install the listener before signalling; otherwise a fast exit can be missed.
  const exited = once(child, "exit").then(() => true, () => true);
  child.kill("SIGTERM");
  const graceful = await Promise.race([
    exited,
    new Promise((resolve) => setTimeout(() => resolve(false), 2000)),
  ]);
  if (!graceful && child.exitCode === null && child.signalCode === null) {
    const forcedExit = once(child, "exit").then(() => true, () => true);
    child.kill("SIGKILL");
    await Promise.race([forcedExit, new Promise((resolve) => setTimeout(resolve, 2000))]);
  }
}

test("HMAC connection identifiers are normalized, keyed, and fixed-length", () => {
  const v4 = hashIp("192.0.2.25");
  assert.match(v4, /^[a-f0-9]{32}$/);
  assert.equal(hashIp("::ffff:192.0.2.25"), v4);
  assert.equal(hashIp(" 192.0.2.25 "), v4);
  assert.notEqual(hashIp("192.0.2.26"), v4);
});

test("live server protects socket payloads, authorization, data flow, and persisted strike keys", { timeout: 30000 }, async () => {
  const port = await getFreePort();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "anon-server-test-"));
  const dbPath = path.join(tempDir, "anon-test.db");
  let stdout = "";
  let stderr = "";
  const child = spawn(process.execPath, [path.join(__dirname, "..", "index.js")], {
    cwd: path.resolve(__dirname, ".."),
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      CLIENT_ORIGIN: "http://localhost:3000",
      TRUST_PROXY: "false",
      ADMIN_TOKEN: "test-admin-token-abcdefghijklmnopqrstuvwxyz012345",
      IP_HASH_SECRET: "anon-test-hmac-secret-with-at-least-32-characters",
      ANON_DB_PATH: dbPath,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => { stdout = (stdout + chunk.toString()).slice(-12000); });
  child.stderr.on("data", (chunk) => { stderr = (stderr + chunk.toString()).slice(-12000); });
  let a;
  let b;
  let c;
  try {
    const baseUrl = "http://127.0.0.1:" + port;
    await waitForHttp(baseUrl + "/", child, () => stdout + "\n" + stderr);
    const profileToken = "a".repeat(64);
    const profileTokenB = "b".repeat(64);
    const fullResolutionAvatar = {
      background: "#0a0306",
      gridSize: 32,
      cells: Array.from({ length: 32 * 32 }, (_, index) => index % 7 === 0 ? "#ff4f7f" : null),
    };
    a = io(baseUrl, {
      autoConnect: false, reconnection: false, timeout: 5000, transports: ["websocket"],
      auth: { profileToken, avatarDesign: fullResolutionAvatar },
    });
    b = io(baseUrl, { autoConnect: false, reconnection: false, timeout: 5000, transports: ["websocket"], auth: { profileToken: profileTokenB } });
    const connectA = waitForEvent(a, "connect");
    const readyA = waitForEvent(a, "session:ready");
    const connectB = waitForEvent(b, "connect");
    const readyB = waitForEvent(b, "session:ready");
    a.connect();
    b.connect();
    const [, identityA, , identityB] = await Promise.all([connectA, readyA, connectB, readyB]);

    assert.equal(Object.hasOwn(identityA, "ip"), false, "session-ready must not expose the raw address");
    assert.equal(Object.hasOwn(identityA, "spamKey"), false, "session-ready must not expose internal anti-abuse identifiers");
    assert.match(identityA.profileId, /^profile_[a-f0-9]{32}$/);
    assert.equal(identityA.avatarDesign.gridSize, 32, "the server must retain the original 32×32 grid");
    assert.equal(identityA.avatarDesign.cells.length, 1024, "the server must retain all avatar pixels");

    const incomingMessage = waitForEvent(b, "chat:public:message", (message) => message.content === "privacy-test-message");
    const sendAck = await emitAck(a, "chat:public:send", { content: "privacy-test-message" });
    assert.equal(sendAck.ok, true);
    const message = await incomingMessage;
    assert.equal(message.senderName, identityA.username);
    assert.equal(message.senderProfileId, identityA.profileId, "messages must use the stable anonymous profile key");
    assert.equal(message.avatarDesign.gridSize, 32, "messages must carry the exact sender avatar grid");
    assert.equal(message.avatarDesign.cells.length, 1024, "message avatar snapshots must retain all pixels");
    assert.equal(Object.hasOwn(message, "senderSpamKey"), false, "broadcast messages must not expose anti-abuse keys");
    assert.equal(Object.hasOwn(message, "ip"), false);

    let idempotentDeliveryCount = 0;
    const countIdempotentDelivery = (candidate) => {
      if (candidate.content === "idempotent-retry-message") idempotentDeliveryCount += 1;
    };
    b.on("chat:public:message", countIdempotentDelivery);
    const idempotentPayload = {
      content: "idempotent-retry-message",
      clientMessageId: "client-idempotency-001",
    };
    const firstIdempotentDelivery = waitForEvent(b, "chat:public:message", (candidate) => candidate.content === "idempotent-retry-message");
    const firstIdempotentAck = await emitAck(a, "chat:public:send", idempotentPayload);
    assert.equal(firstIdempotentAck.ok, true);
    await firstIdempotentDelivery;
    const retryIdempotentAck = await emitAck(a, "chat:public:send", idempotentPayload);
    assert.equal(retryIdempotentAck.ok, true);
    assert.equal(retryIdempotentAck.id, firstIdempotentAck.id, "retry must return the original message ID");
    assert.equal(retryIdempotentAck.deduplicated, true);
    const conflictingRetry = await emitAck(a, "chat:public:send", { ...idempotentPayload, content: "different content" });
    assert.equal(conflictingRetry.ok, false, "a client ID cannot be reused for different content");
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(idempotentDeliveryCount, 1, "retry must not broadcast a duplicate message");
    b.off("chat:public:message", countIdempotentDelivery);

    const createPost = await emitAck(a, "confession:create", { text: "Shared feature test", author: "ForgedAuthor123" });
    assert.equal(createPost.ok, true);
    const listResult = await emitAck(b, "confession:list", {});
    assert.equal(listResult.ok, true);
    const post = listResult.confessions.find((item) => item.id === createPost.confession.id);
    assert.ok(post);
    assert.equal(post.author, identityA.username, "the server must derive authorship from the current session");
    assert.equal(Object.hasOwn(post, "authorSessionId"), false);

    const voteResult = await emitAck(b, "confession:vote", { confessionId: post.id, dir: 1 });
    assert.equal(voteResult.ok, true);
    const replyResult = await emitAck(b, "confession:reply", { confessionId: post.id, text: "Reply from second client" });
    assert.equal(replyResult.ok, true);
    const refreshed = await emitAck(b, "confession:list", {});
    const refreshedPost = refreshed.confessions.find((item) => item.id === post.id);
    assert.equal(refreshedPost.upvotes, 1);
    assert.equal(refreshedPost.replies[0].author, identityB.username);
    assert.equal((await emitAck(b, "election:vote", { candidate: identityA.username })).ok, true);

    const roomResult = await emitAck(a, "room:create", { capacity: 3, topic: "security test" });
    assert.equal(roomResult.ok, true);
    const slowModeAck = await emitAck(a, "room:set-slowmode", { roomId: roomResult.room.roomId, seconds: 3 });
    assert.equal(slowModeAck.ok, true);
    const roomMessagePayload = {
      roomId: roomResult.room.roomId,
      content: "idempotent-room-retry",
      clientMessageId: "room-idempotency-001",
    };
    const roomDelivery = waitForEvent(a, "room:message", (candidate) => candidate.content === "idempotent-room-retry");
    const roomFirstAck = await emitAck(a, "room:message", roomMessagePayload);
    assert.equal(roomFirstAck.ok, true);
    await roomDelivery;
    const roomRetryAck = await emitAck(a, "room:message", roomMessagePayload);
    assert.equal(roomRetryAck.ok, true);
    assert.equal(roomRetryAck.id, roomFirstAck.id);
    assert.equal(roomRetryAck.deduplicated, true, "retry must bypass slow mode after original acceptance");
    const inviteResult = await emitAck(a, "room:invite", { roomId: roomResult.room.roomId, recipientUsername: identityB.username });
    assert.equal(inviteResult.ok, true);
    const wrongDecline = await emitAck(a, "invite:decline", { inviteId: inviteResult.inviteId });
    assert.equal(wrongDecline.ok, false);
    assert.match(wrongDecline.error, /not your invitation/i);
    const rightfulDecline = await emitAck(b, "invite:decline", { inviteId: inviteResult.inviteId });
    assert.equal(rightfulDecline.ok, true);

    const malformedAck = await emitAck(a, "chat:public:send", null);
    assert.equal(malformedAck.ok, false);
    assert.match(malformedAck.error, /empty message/i);
    assert.ok((await fetch(baseUrl + "/")).ok, "malformed payload should not terminate the server");

    // Force a strike and inspect the DB: persisted IP-derived keys must contain only HMAC hex.
    await emitAck(a, "chat:public:send", { content: "repeat-for-strike-test" });
    await emitAck(a, "chat:public:send", { content: "repeat-for-strike-test" });
    const repeated = await emitAck(a, "chat:public:send", { content: "repeat-for-strike-test" });
    assert.equal(repeated.ok, false);

    const reportAck = await emitAck(a, "report:user", {
      targetSessionId: identityB.sessionId,
      targetUsername: identityB.username,
      reason: "integration test report",
    });
    assert.equal(reportAck.ok, true);
    const adminReportsResponse = await fetch(baseUrl + "/api/admin/reports", { headers: { "x-admin-token": "test-admin-token-abcdefghijklmnopqrstuvwxyz012345" } });
    const adminReportsPayload = await adminReportsResponse.json();
    const persistedReport = adminReportsPayload.reports.find((report) => report.reason === "integration test report");
    assert.ok(persistedReport, "admin review must read the durably stored report");
    const reviewResponse = await fetch(baseUrl + "/api/admin/reports/" + encodeURIComponent(persistedReport.id) + "/review", {
      method: "POST",
      headers: {
        "x-admin-token": "test-admin-token-abcdefghijklmnopqrstuvwxyz012345",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "dismiss" }),
    });
    assert.equal(reviewResponse.status, 200, "admin review should acknowledge a saved decision");
    const reviewedResponse = await fetch(baseUrl + "/api/admin/reports", {
      headers: { "x-admin-token": "test-admin-token-abcdefghijklmnopqrstuvwxyz012345" },
    });
    const reviewedPayload = await reviewedResponse.json();
    assert.equal(reviewedPayload.reports.find((report) => report.id === persistedReport.id).reviewed, true);
    const statsResponse = await fetch(baseUrl + "/api/stats");
    const statsPayload = await statsResponse.json();
    assert.ok(statsPayload.persistent_rows >= 2, "public stats should count persisted reports and strikes");

    const blockAck = await emitAck(a, "block:user", {
      targetSessionId: identityB.sessionId,
      targetUsername: identityB.username,
    });
    assert.equal(blockAck.ok, true, "blocking an active profile should succeed");
    const blockedBeforeReconnect = await emitAck(a, "blocked:list", {});
    assert.equal(blockedBeforeReconnect.ok, true);
    assert.ok(blockedBeforeReconnect.blocked.some((entry) => entry.profileId === identityB.profileId));
    const botBlockAck = await emitAck(a, "block:user", {
      targetSessionId: "bot_SilentWolf482",
      targetUsername: "SilentWolf482",
    });
    assert.equal(botBlockAck.ok, true, "blocking an AI participant must remain supported");
    assert.equal(botBlockAck.persistent, true, "AI participant identities are stable");
    const blockedWithBot = await emitAck(a, "blocked:list", {});
    const blockedBot = blockedWithBot.blocked.find((entry) => entry.username === "SilentWolf482");
    assert.ok(blockedBot, "blocked list must include the AI participant");
    const unblockBotAck = await emitAck(a, "unblock:user", { profileId: blockedBot.profileId });
    assert.equal(unblockBotAck.ok, true);


    const originalProfileId = identityA.profileId;
    b.disconnect();
    b = null;
    a.disconnect();
    a = null;
    c = io(baseUrl, {
      autoConnect: false, reconnection: false, timeout: 5000, transports: ["websocket"],
      auth: { profileToken, avatarDesign: fullResolutionAvatar },
    });
    const reconnectReady = waitForEvent(c, "session:ready");
    const reconnectConnect = waitForEvent(c, "connect");
    c.connect();
    const [, identityAfterReload] = await Promise.all([reconnectConnect, reconnectReady]);
    assert.notEqual(identityAfterReload.sessionId, identityA.sessionId, "each socket connection still gets a fresh session ID");
    assert.equal(identityAfterReload.profileId, originalProfileId, "the anonymous profile ID must survive a reload");
    const retryAfterReconnect = await emitAck(c, "chat:public:send", idempotentPayload);
    assert.equal(retryAfterReconnect.ok, true);
    assert.equal(retryAfterReconnect.id, firstIdempotentAck.id, "the same profile can safely retry after reconnecting");
    assert.equal(retryAfterReconnect.deduplicated, true);
    const blockedAfterReconnect = await emitAck(c, "blocked:list", {});
    assert.equal(blockedAfterReconnect.ok, true);
    assert.ok(blockedAfterReconnect.blocked.some((entry) => entry.profileId === identityB.profileId), "blocks must survive a reconnect");
    assert.equal(blockedAfterReconnect.blocked.find((entry) => entry.profileId === identityB.profileId).sessionId, "", "offline blocked users remain manageable without an active session");
    const unblockAck = await emitAck(c, "unblock:user", { profileId: identityB.profileId });
    assert.equal(unblockAck.ok, true, "unblocking must remove the persisted profile block");
    const blockedAfterUnblock = await emitAck(c, "blocked:list", {});
    assert.equal(blockedAfterUnblock.blocked.length, 0);

    assert.equal(identityAfterReload.avatarDesign.gridSize, 32, "the avatar must survive a reload at full resolution");
    c.disconnect();
    c = null;
    await stopChild(child);

    const { DatabaseSync } = require("node:sqlite");
    const database = new DatabaseSync(dbPath);
    const strikeRows = database.prepare("SELECT spam_key FROM strikes").all();
    assert.ok(strikeRows.length > 0, "a spam strike should have been persisted");
    assert.ok(strikeRows.every((row) => /^ip:[a-f0-9]{32}$/i.test(row.spam_key)), "database strikes must never persist raw IP values");
    database.close();
  } finally {
    if (a) a.disconnect();
    if (b) b.disconnect();
    if (c) c.disconnect();
    await stopChild(child);
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
