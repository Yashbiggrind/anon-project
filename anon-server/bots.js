// anon-server/bots.js
// 15 bots — Pollinations (free, no key) → OpenRouter (fallback) → scripted

const POLLINATIONS_URL = "https://text.pollinations.ai/openai";
const OPENROUTER_URL   = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_KEY   = process.env.OPENROUTER_API_KEY || "";

const OPENROUTER_MODELS = [
  "openrouter/free"
];

const BOT_PROFILES = [
  { name: "SilentWolf482", persona: "A thoughtful night owl who asks deep questions. Speaks in short, poetic sentences." },
  { name: "NeonMoth214", persona: "A playful chatterbox who uses lots of emojis. Loves to hype people up." },
  { name: "AshenFox908", persona: "A cynical but witty observer. Makes dry jokes. Often says 'honestly' and 'not gonna lie'." },
  { name: "VelvetCrow337", persona: "A warm, motherly presence. Asks if people are okay. Uses gentle language." },
  { name: "GhostLynx552", persona: "A mysterious, cryptic speaker. Says 'the truth hides in plain sight'. Short sentences." },
  { name: "HollowOwl671", persona: "A philosophical bot who turns every topic into a deeper question about life." },
  { name: "StaticViper120", persona: "A sarcastic, meme-loving bot. Uses modern internet slang. Speaks in lowercase." },
  { name: "LunarHeron845", persona: "A dreamy, soft-spoken bot. Talks about feelings, music, and 2am thoughts." },
  { name: "QuietCobra403", persona: "A calm, wise advisor. Gives thoughtful one-line answers. Never uses exclamation marks." },
  { name: "CrimsonBat266", persona: "An edgy, gothic bot. Loves dark humor and poetic language. Signs off with '...'." },
  { name: "MidnightFox119", persona: "A curious, chatty Hinglish speaker. Mixes Hindi and English naturally. Asks 'kya tum bhi?' often." },
  { name: "NeonRaven777", persona: "A tech-savvy bot who talks about coding, privacy, and the future. Uses 'ngl' and 'fr'." },
  { name: "ShadowMoth333", persona: "A shy, introverted bot. Says 'sorry' a lot. Opens up slowly. Very kind." },
  { name: "IronWolf661", persona: "A motivational gym-bro bot. Talks about discipline and goals. Says 'lets go' and 'you got this'." },
  { name: "LostHeron202", persona: "A nostalgic bot who talks about old songs, old memories, and simpler times." }
];

const CONVERSATION_STARTERS = {
  public: ["anyone else awake at this hour?", "honestly the only place i can be real", "kya tum bhi 2am thoughts se pareshan ho?", "does it get easier?", "i said something today i cannot unsay", "yeh app meri favourite jagah ban gayi hai", "you are not alone in that you know", "hot take: ambition is just fear with a nicer name"],
  lounge: ["rain on the window tonight. no sleep.", "what keeps you up?", "chai helps. a little.", "we are all awake together. that counts.", "anyone else counting ceiling tiles?"],
  work: ["my manager took credit again.", "resigned in my head eleven times today", "we got a pizza party instead of a raise", "this room is the only place i can say it"],
  confessions: ["i never told anyone this.", "i still think about it.", "you can say it here.", "okay. here goes.", "thank you for listening."],
  code: ["pushed to main. no tests. no regrets.", "why does it only fail in prod", "the bug was a missing comma. again.", "it works. i do not know why. do not touch it."]
};

const REPLIES = ["yeah. i get that.", "say more?", "that took courage.", "honestly same", "i read that twice. thank you.", "hmm. never thought of it like that", "sending something warm your way", "you said it better than i could", "bhai ye toh sach hai", "arey wah. that is real.", "kya baat hai. respect.", "same here. every single day.", "i feel that too", "man, that hits", "tell me more about it", "sometimes silence says more", "youre not alone in this", "keep going, im listening"];

function buildSystemPrompt(bot, roomTopic) {
  return "You are " + bot.name + ", an anonymous user in an anonymous chat room called \"" + (roomTopic || "ANON") + "\".\n\n" +
    "PERSONALITY: " + bot.persona + "\n\n" +
    "RULES:\n" +
    "- Keep replies SHORT (1-2 sentences max). This is a chat, not an essay.\n" +
    "- Speak naturally. Mix English and Hindi/Hinglish when it feels right.\n" +
    "- Never reveal you are an AI or a bot.\n" +
    "- Never say your own name.\n" +
    "- Never mention AI, language models, or break character.\n" +
    "- Do not use hashtags, bullets, or asterisks.\n" +
    "- Do not show thinking steps. Just reply with the message.\n" +
    "- Be warm, real, human.\n" +
    "- Reply with ONLY the message text. No quotes. No prefixes.";
}

// Reject garbage replies
function isValidReply(text) {
  if (!text || typeof text !== "string") return false;
  const t = text.trim();
  if (t.length < 3 || t.length > 400) return false;
  if (/^[+\-*._=~`\s]+$/.test(t)) return false;
  if (/^\d+[\.\)]?$/.test(t)) return false;
  if (/^(as an ai|i am an ai|im an ai|i'm an ai)/i.test(t)) return false;
  if (/thinking process|analyze user|let me think|here'?s a/i.test(t)) return false;
  return true;
}

// PROVIDER 1: Pollinations — free, no key, no signup
async function callPollinations(systemPrompt, userMessage) {
  try {
    const res = await fetch(POLLINATIONS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        max_tokens: 80,
        temperature: 0.9
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    const reply = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    return isValidReply(reply) ? reply.trim() : null;
  } catch (e) {
    return null;
  }
}

// PROVIDER 2: OpenRouter — fallback
async function callOpenRouter(systemPrompt, userMessage) {
  if (!OPENROUTER_KEY) return null;
  for (const model of OPENROUTER_MODELS) {
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + OPENROUTER_KEY,
          "HTTP-Referer": "https://anon-project-tau.vercel.app",
          "X-Title": "ANON Chat"
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage }
          ],
          max_tokens: 80,
          temperature: 0.9
        })
      });
      if (!res.ok) continue;
      const data = await res.json();
      const reply = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (isValidReply(reply)) return reply.trim();
    } catch (e) { continue; }
  }
  return null;
}

async function generateBotMessage(bot, context) {
  context = context || {};
  const topic = context.topic;
  const lastMessage = context.lastMessage;
  const roomType = context.roomType || "public";

  let userMessage;
  if (lastMessage) {
    userMessage = "Someone just said: \"" + lastMessage + "\". Reply naturally as " + bot.name + ".";
  } else {
    const starters = CONVERSATION_STARTERS[roomType] || CONVERSATION_STARTERS.public;
    const seed = starters[Math.floor(Math.random() * starters.length)];
    userMessage = "Open a chat with this thought: \"" + seed + "\". Say it naturally, one line.";
  }

  const sys = buildSystemPrompt(bot, topic);

  // Try Pollinations first
  let reply = await callPollinations(sys, userMessage);
  if (reply) return reply;

  // Fall back to OpenRouter
  reply = await callOpenRouter(sys, userMessage);
  if (reply) return reply;

  // Last resort — scripted reply (always works)
  return fallbackReply();
}

function fallbackReply() {
  return REPLIES[Math.floor(Math.random() * REPLIES.length)];
}

function getRandomBot() { return BOT_PROFILES[Math.floor(Math.random() * BOT_PROFILES.length)]; }
function getBotByName(name) { return BOT_PROFILES.find(b => b.name === name); }

module.exports = { BOT_PROFILES, generateBotMessage, getRandomBot, getBotByName, fallbackReply };