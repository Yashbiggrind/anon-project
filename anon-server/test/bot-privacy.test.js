"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const originalFetch = global.fetch;
const originalExternalFlag = process.env.ENABLE_EXTERNAL_BOT_AI;
const originalOpenRouterKey = process.env.OPENROUTER_API_KEY;
const modulePath = require.resolve("../bots");

function loadBots(externalEnabled) {
  delete require.cache[modulePath];
  if (externalEnabled) process.env.ENABLE_EXTERNAL_BOT_AI = "on";
  else delete process.env.ENABLE_EXTERNAL_BOT_AI;
  process.env.OPENROUTER_API_KEY = "";
  return require("../bots");
}

test("external AI is disabled by default", async () => {
  let calls = 0;
  global.fetch = async () => { calls += 1; throw new Error("Network call should not happen"); };
  const { BOT_PROFILES, generateBotMessage } = loadBots(false);
  const reply = await generateBotMessage(BOT_PROFILES[0], { roomType: "public" });
  assert.equal(typeof reply, "string");
  assert.ok(reply.length > 0);
  assert.equal(calls, 0);
});

test("real user messages and custom room topics are never forwarded to external providers", async () => {
  let calls = 0;
  const requestBodies = [];
  global.fetch = async (_url, options) => {
    calls += 1;
    requestBodies.push(JSON.parse(options.body));
    return { ok: false, status: 503 };
  };

  const { BOT_PROFILES, generateBotMessage, getBotByName } = loadBots(true);
  const profile = BOT_PROFILES[0];

  // Even with external generation opted in, replies to user-authored messages stay local.
  const reply = await generateBotMessage(profile, {
    topic: "PRIVATE_TOPIC_SENTINEL",
    lastMessage: "PRIVATE_MESSAGE_SENTINEL",
    roomType: "work",
  });
  assert.equal(typeof reply, "string");
  assert.equal(calls, 0);

  // An AI opener may call a provider, but only with static bot prompts and a fixed room label.
  await generateBotMessage(profile, {
    topic: "PRIVATE_TOPIC_SENTINEL",
    lastMessage: null,
    roomType: "work",
  });
  assert.equal(calls, 1);
  const serialized = JSON.stringify(requestBodies[0]);
  assert.equal(serialized.includes("PRIVATE_TOPIC_SENTINEL"), false);
  assert.equal(serialized.includes("PRIVATE_MESSAGE_SENTINEL"), false);
  assert.match(serialized, /AI bot account/);
  assert.equal(getBotByName("AI · " + profile.name), profile);
});

test.after(() => {
  global.fetch = originalFetch;
  if (originalExternalFlag === undefined) delete process.env.ENABLE_EXTERNAL_BOT_AI;
  else process.env.ENABLE_EXTERNAL_BOT_AI = originalExternalFlag;
  if (originalOpenRouterKey === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = originalOpenRouterKey;
  delete require.cache[modulePath];
});
