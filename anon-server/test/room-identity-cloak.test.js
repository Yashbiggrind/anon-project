"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { spawn } = require("node:child_process");
const { io } = require("socket.io-client");

const serverDirectory = path.join(__dirname, "..");
let child;
let tempDirectory;
let clients = [];
let baseUrl;

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  return port;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForHttpReady(url) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await delay(50);
  }
  throw new Error("ANON test server did not become ready");
}

function waitForEvent(socket, eventName, predicate = () => true, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, onEvent);
      reject(new Error("Timed out waiting for " + eventName));
    }, timeoutMs);
    function onEvent(payload) {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(eventName, onEvent);
      resolve(payload);
    }
    socket.on(eventName, onEvent);
  });
}

function emitAck(socket, eventName, payload) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timed out waiting for " + eventName + " acknowledgement")), 4000);
    socket.emit(eventName, payload, (response) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

async function connectClient(username) {
  const socket = io(baseUrl, {
    transports: ["websocket"],
    reconnection: false,
    timeout: 3500,
    auth: { username },
  });
  clients.push(socket);
  const ready = waitForEvent(socket, "session:ready");
  await new Promise((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });
  const session = await ready;
  return { socket, session };
}

test("private-room names and member IDs are scoped to the room", async (t) => {
  tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "anon-room-cloak-"));
  const port = await freePort();
  baseUrl = "http://127.0.0.1:" + port;
  const env = {
    ...process.env,
    NODE_ENV: "test",
    PORT: String(port),
    CLIENT_ORIGIN: "http://localhost:3000",
    SERVER_ORIGIN: baseUrl,
    ANON_DB_PATH: path.join(tempDirectory, "anon.sqlite"),
    IP_HASH_SECRET: "test-only-room-cloak-secret-0123456789",
    ADMIN_TOKEN: "test-only-admin-token",
    ANON_SESSION_LOGS: "off",
    ENABLE_BOTS: "false",
  };
  child = spawn(process.execPath, ["index.js"], {
    cwd: serverDirectory,
    env,
    stdio: "ignore",
  });
  t.after(async () => {
    for (const socket of clients) socket.disconnect();
    clients = [];
    if (child && child.exitCode === null) child.kill("SIGTERM");
    if (tempDirectory) fs.rmSync(tempDirectory, { recursive: true, force: true });
  });

  await waitForHttpReady(baseUrl + "/");
  const alice = await connectClient("Alice111");
  const bob = await connectClient("Bob222");

  const created = await emitAck(alice.socket, "room:create", { capacity: 3, topic: "Alias test room" });
  assert.equal(created.ok, true);
  const firstRoom = created.room;
  assert.equal(firstRoom.identityScope, "room");
  assert.ok(firstRoom.myMemberId);
  assert.notEqual(firstRoom.myMemberId, alice.session.sessionId);
  const aliceMember = firstRoom.participants.find((p) => p.sessionId === firstRoom.myMemberId);
  assert.ok(aliceMember);
  assert.notEqual(aliceMember.username, alice.session.username);
  assert.equal(firstRoom.admin, firstRoom.myMemberId);

  const bobJoined = await emitAck(bob.socket, "room:join", { roomId: firstRoom.roomId });
  assert.equal(bobJoined.ok, true);
  assert.equal(bobJoined.room.identityScope, "room");
  assert.notEqual(bobJoined.room.myMemberId, bob.session.sessionId);

  const aliceAliasForBob = bobJoined.room.participants.find((p) => p.sessionId === firstRoom.myMemberId);
  assert.ok(aliceAliasForBob);
  assert.equal(aliceAliasForBob.username, aliceMember.username);
  assert.notEqual(aliceAliasForBob.sessionId, alice.session.sessionId);

  const incomingRoomMessage = waitForEvent(bob.socket, "room:message", (m) => m.content === "room-scoped message");
  const sendAck = await emitAck(alice.socket, "room:message", {
    roomId: firstRoom.roomId,
    content: "room-scoped message",
  });
  assert.equal(sendAck.ok, true);
  const roomMessage = await incomingRoomMessage;
  assert.equal(roomMessage.identityScope, "room");
  assert.equal(roomMessage.senderName, aliceMember.username);
  assert.notEqual(roomMessage.senderName, alice.session.username);
  assert.notEqual(roomMessage.senderSessionId, alice.session.sessionId);

  // The same live session gets a new public alias and member token in a new room.
  const leaveNotice = waitForEvent(bob.socket, "room:system", (evt) => evt.type === "leave" && evt.username === aliceMember.username);
  alice.socket.emit("room:leave", { roomId: firstRoom.roomId });
  await leaveNotice;

  const secondCreated = await emitAck(alice.socket, "room:create", { capacity: 3, topic: "Second alias test room" });
  assert.equal(secondCreated.ok, true);
  const secondRoom = secondCreated.room;
  const secondAlice = secondRoom.participants.find((p) => p.sessionId === secondRoom.myMemberId);
  assert.ok(secondAlice);
  assert.notEqual(secondAlice.username, aliceMember.username);
  assert.notEqual(secondRoom.myMemberId, firstRoom.myMemberId);
});
