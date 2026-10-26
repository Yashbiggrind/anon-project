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
  try {
    const baseUrl = "http://127.0.0.1:" + port;
    await waitForHttp(baseUrl + "/", child, () => stdout + "\n" + stderr);
    a = io(baseUrl, { autoConnect: false, reconnection: false, timeout: 5000, transports: ["websocket"] });
    b = io(baseUrl, { autoConnect: false, reconnection: false, timeout: 5000, transports: ["websocket"] });
    const connectA = waitForEvent(a, "connect");
    const readyA = waitForEvent(a, "session:ready");
    const connectB = waitForEvent(b, "connect");
    const readyB = waitForEvent(b, "session:ready");
    a.connect();
    b.connect();
    const [, identityA, , identityB] = await Promise.all([connectA, readyA, connectB, readyB]);

    assert.equal(Object.hasOwn(identityA, "ip"), false, "session-ready must not expose the raw address");
    assert.equal(Object.hasOwn(identityA, "spamKey"), false, "session-ready must not expose internal anti-abuse identifiers");

    const incomingMessage = waitForEvent(b, "chat:public:message", (message) => message.content === "privacy-test-message");
    const sendAck = await emitAck(a, "chat:public:send", { content: "privacy-test-message" });
    assert.equal(sendAck.ok, true);
    const message = await incomingMessage;
    assert.equal(message.senderName, identityA.username);
    assert.equal(Object.hasOwn(message, "senderSpamKey"), false, "broadcast messages must not expose anti-abuse keys");
    assert.equal(Object.hasOwn(message, "ip"), false);

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

    a.disconnect();
    b.disconnect();
    a = null;
    b = null;
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
    await stopChild(child);
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
