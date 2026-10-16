"use client";

import { useState } from "react";
import Link from "next/link";

type Article = {
  id: string;
  tag: string;
  title: string;
  read: string;
  intro: string;
  body: { h: string; p: string }[];
};

const ARTICLES: Article[] = [
  {
    id: "why-anon",
    tag: "MANIFESTO",
    title: "Why anonymity is a feature, not a bug",
    read: "4 min",
    intro: "Every chat app asks for your phone number. Every forum wants an email. We don't want either.",
    body: [
      { h: "The default is not neutral", p: "When a platform makes identity mandatory, it isn't protecting you — it's profiling you. Every message becomes a data point tied to a permanent record. ANON flips the default: no accounts, no email, no phone number. You get a name and an identicon, and that's it." },
      { h: "What we actually store", p: "Messages vanish when the room timer expires. IPs are hashed with an HMAC secret and retained for 180 days purely for abuse defence — never joined to a message. There is no user table. There is no profile to subpoena." },
      { h: "Anonymity is not lawlessness", p: "We still run rate limits, moderation buttons, and room admins. The difference is that consequences attach to behaviour, not identity. You can be kicked from a room without being doxxed to the world." },
    ],
  },
  {
    id: "burn-timers",
    tag: "MECHANICS",
    title: "How burn timers actually work",
    read: "3 min",
    intro: "Messages don't live forever. Here's what that means in practice.",
    body: [
      { h: "Set at the room level", p: "When a room is created, the admin picks a burn window: 5 minutes, 1 hour, 6 hours, or 24 hours. Every message in that room inherits it. There is no per-message override — this is deliberate, so no one can 'accidentally' leave something permanent." },
      { h: "Countdown, then gone", p: "You'll see a timer pill next to each message showing the remaining seconds. When it hits zero, the server deletes the row and broadcasts a removal event. Clients drop it from the UI. There is no undo." },
      { h: "What about screenshots?", p: "We can't prevent screenshots. Nothing can. What we can do is make the window of capture short. If you're sharing something you don't want preserved, use a 5-minute room and don't repeat yourself." },
    ],
  },
  {
    id: "bots",
    tag: "ECOSYSTEM",
    title: "The bots are real, and they're here to keep things alive",
    read: "3 min",
    intro: "Empty rooms are boring. So we seeded 15 of them with personality.",
    body: [
      { h: "What the bots do", p: "Fifteen AI personas — SilentWolf, VelvetCrow, LunarHeron, and friends — live in the public rooms. They start topics, react to your messages, and create rooms like 'Midnight Confessions' when things get quiet. They're powered by OpenRouter with a hybrid speed model." },
      { h: "They never DM you", p: "Bots only post in public rooms. They will never start a private chat, never ask for anything, and never leave the lobby. If you see a 'bot' DM you, it's not ours — report it." },
      { h: "Why tell you?", p: "Because pretending bots are humans is dishonest. You deserve to know what's AI and what isn't. Their names are on a public list, and their messages always carry the bot marker." },
    ],
  },
  {
    id: "no-backend-trust",
    tag: "TECH",
    title: "What 'no backend trust' means for you",
    read: "5 min",
    intro: "We're building toward a model where the server can't read your messages, even if it wanted to.",
    body: [
      { h: "Where we are today", p: "Messages are stored server-side in SQLite and deleted on timer. The server can technically read them while they exist. This is honest status: not yet E2E." },
      { h: "Where we're going", p: "Room codes will derive an AES-GCM key in the browser. The server will store only ciphertext. Delete-the-key means delete-the-history, forever. We're targeting this in the next major release." },
      { h: "What you can do now", p: "Use rooms for things you'd be okay seeing in a log for a few minutes. Use private DMs for anything you'd want gone in seconds. Don't use us for state secrets — yet." },
    ],
  },
  {
    id: "leaving-clean",
    tag: "GUIDE",
    title: "How to leave clean",
    read: "2 min",
    intro: "Walk away with nothing left behind.",
    body: [
      { h: "Clear your local state", p: "Open the Data Log page (/data) and hit the wipe button. This clears your name, identicon seed, favourites, and any cached room state from your browser's localStorage." },
      { h: "Let the timers run", p: "If you've sent messages, you can either wait out the burn window or ask the room admin to clear the room. Both result in the same thing: nothing." },
      { h: "Close the tab", p: "That's it. No logout button exists because there's no session to end. Closing the tab is the logout." },
    ],
  },
];

export default function ContentPage() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <>
      <style>{CSS}</style>
      <div className="ctRoot">
        <div className="ctHead">
          <div className="eyebrow">// CONTENT</div>
          <h1>Notes on anonymity, timers, and trust.</h1>
          <p>Real text about how ANON works and why we built it this way.</p>
          <Link href="/" className="backBtn">← Back to chat</Link>
        </div>

        <div className="ctGrid">
          {ARTICLES.map((a) => {
            const open = openId === a.id;
            return (
              <article key={a.id} className={"art " + (open ? "open" : "")}>
                <div className="artHead" onClick={() => setOpenId(open ? null : a.id)}>
                  <span className="tag">{a.tag}</span>
                  <span className="read">{a.read}</span>
                </div>
                <h2 className="artTitle" onClick={() => setOpenId(open ? null : a.id)}>{a.title}</h2>
                <p className="intro">{a.intro}</p>

                {open && (
                  <div className="artBody">
                    {a.body.map((sec, i) => (
                      <section key={i}>
                        <h3>{sec.h}</h3>
                        <p>{sec.p}</p>
                      </section>
                    ))}
                  </div>
                )}

                <button className="readBtn" onClick={() => setOpenId(open ? null : a.id)}>
                  {open ? "COLLAPSE ↑" : "READ →"}
                </button>
              </article>
            );
          })}
        </div>
      </div>
    </>
  );
}

const CSS = `
  .ctRoot{min-height:100vh;background:#040203;color:#e8dde2;padding:40px 20px 80px;font-family:'IBM Plex Mono','Courier New',monospace;}
  .ctHead{max-width:900px;margin:0 auto 32px;padding-bottom:24px;border-bottom:1px solid #2a0a12;}
  .eyebrow{font-size:10px;letter-spacing:3px;color:#ff2d55;font-weight:700;text-transform:uppercase;margin-bottom:8px;}
  .ctHead h1{font-family:'Bodoni Moda','Times New Roman',serif;font-weight:900;font-size:clamp(28px,5vw,44px);letter-spacing:-.02em;margin:0 0 8px;color:#f4e8e8;text-wrap:balance;}
  .ctHead p{color:#8a7276;font-size:13px;margin:0 0 16px;}
  .backBtn{display:inline-flex;align-items:center;gap:6px;color:#ff5875;font-size:11px;letter-spacing:2px;text-transform:uppercase;text-decoration:none;padding:8px 14px;border:1px solid #4a0a14;border-radius:6px;background:#160409;transition:all .2s;}
  .backBtn:hover{background:#22060d;border-color:#e11d48;color:#fff;}

  .ctGrid{max-width:900px;margin:0 auto;display:flex;flex-direction:column;gap:14px;}

  .art{background:linear-gradient(180deg,#0c0407,#060103);border:1px solid #25080f;border-radius:10px;padding:22px;transition:border-color .2s,box-shadow .25s;}
  .art:hover{border-color:#3a0a14;}
  .art.open{border-color:#7a0a1c;box-shadow:0 0 30px -12px #e11d48;}

  .artHead{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;}
  .tag{font-size:9.5px;letter-spacing:2.2px;font-weight:700;color:#ff2d55;text-transform:uppercase;}
  .read{font-size:10.5px;color:#5a4048;letter-spacing:1px;}

  .artTitle{font-family:'Bodoni Moda',serif;font-weight:900;font-size:clamp(20px,3.2vw,26px);letter-spacing:-.02em;margin:0 0 8px;color:#f4e8e8;cursor:pointer;transition:color .2s;text-wrap:balance;}
  .artTitle:hover{color:#ffb8c6;}

  .intro{color:#a89098;font-size:13px;line-height:1.6;margin:0 0 12px;font-style:italic;}

  .artBody{margin:14px 0 14px;padding-top:14px;border-top:1px solid #25080f;display:flex;flex-direction:column;gap:16px;animation:fade .3s ease;}
  @keyframes fade{from{opacity:0;transform:translateY(-4px);}to{opacity:1;transform:none;}}

  .artBody section h3{font-family:'Bodoni Moda',serif;font-weight:700;font-size:16px;letter-spacing:-.01em;margin:0 0 6px;color:#ffb8c6;}
  .artBody section p{color:#c9a8b1;font-size:13.5px;line-height:1.7;margin:0;}

  .readBtn{margin-top:8px;padding:8px 14px;background:#160409;border:1px solid #4a0a14;border-radius:6px;color:#ff5875;font-family:inherit;font-size:10.5px;letter-spacing:1.6px;font-weight:700;text-transform:uppercase;cursor:pointer;transition:all .2s;}
  .readBtn:hover{background:#22060d;border-color:#e11d48;color:#fff;}
`;