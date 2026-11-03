"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { spawn } = require("node:child_process");
const { io } = require("socket.io-client");

async function availablePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitForServer(url, child, timeoutMs = 10000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (child.exitCode !== null) throw new Error("ANON server exited before becoming ready.");
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("ANON test server did not become ready in time.");
}

function connectSession(url, username) {
  const socket = io(url, {
    autoConnect: false,
    auth: { username },
    timeout: 1500,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 100,
  });
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("session:ready timed out")), 6000);
    socket.once("session:ready", (session) => {
      clearTimeout(timer);
      resolve(session);
    });
    socket.once("connect_error", (error) => {
      // Let Socket.IO retry while the test server is starting; the outer timeout is decisive.
      if (socket.active === false) {
        clearTimeout(timer);
        reject(error);
      }
    });
  });
  socket.connect();
  return { socket, ready };
}

async function emitAck(socket, event, payload) {
  return socket.timeout(4000).emitWithAck(event, payload);
}

test("room reply metadata uses the room-local alias instead of a global username", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "anon-room-alias-test-"));
  const port = await availablePort();
  const url = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [path.join(__dirname, "..", "index.js")], {
    cwd: path.join(__dirname, ".."),
    stdio: "ignore",
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      CLIENT_ORIGIN: "http://localhost:3000",
      SERVER_ORIGIN: url,
      TRUST_PROXY: "false",
      ENABLE_BOTS: "false",
      ANON_SESSION_LOGS: "off",
      ANON_DB_PATH: path.join(directory, "test.sqlite"),
      IP_HASH_SECRET: "test-only-room-alias-secret",
    },
  });

  const sockets = [];
  t.after(async () => {
    for (const socket of sockets) socket.disconnect();
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 1500);
        child.once("exit", () => { clearTimeout(timer); resolve(); });
      });
    }
    fs.rmSync(directory, { recursive: true, force: true });
  });

  await waitForServer(url, child);
  const aliceConnection = connectSession(url, "Alice123");
  const bobConnection = connectSession(url, "Bob456");
  sockets.push(aliceConnection.socket, bobConnection.socket);
  const [alice, bob] = await Promise.all([aliceConnection.ready, bobConnection.ready]);

  const created = await emitAck(aliceConnection.socket, "room:create", { capacity: 3, topic: "alias regression" });
  assert.equal(created.ok, true);
  const roomId = created.room.roomId;
  const aliceMemberId = created.room.myMemberId;
  const aliceAlias = created.room.participants.find((member) => member.sessionId === aliceMemberId)?.username;
  assert.ok(aliceAlias);
  assert.notEqual(aliceAlias, alice.username);

  const joined = await emitAck(bobConnection.socket, "room:join", { roomId });
  assert.equal(joined.ok, true);
  const bobMemberId = joined.room.myMemberId;
  const bobAlias = joined.room.participants.find((member) => member.sessionId === bobMemberId)?.username;
  assert.ok(bobAlias);
  assert.notEqual(bobAlias, bob.username);
  assert.notEqual(aliceMemberId, alice.sessionId);
  assert.notEqual(bobMemberId, bob.sessionId);

  const receivedMessage = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("room message timed out")), 4000);
    bobConnection.socket.once("room:message", (message) => {
      clearTimeout(timer);
      resolve(message);
    });
  });

  const sent = await emitAck(aliceConnection.socket, "room:message", {
    roomId,
    content: "Testing room aliases",
    replyTo: {
      id: "reply-test",
      senderName: bob.username,
      content: "A quoted message",
    },
  });
  assert.equal(sent.ok, true);

  const message = await receivedMessage;
  assert.equal(message.identityScope, "room");
  assert.equal(message.senderName, aliceAlias);
  assert.equal(message.senderSessionId, aliceMemberId);
  assert.equal(message.replyTo.senderName, bobAlias);
  assert.notEqual(message.replyTo.senderName, bob.username);
});
