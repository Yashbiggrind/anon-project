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
    title: "Why pseudonyms are a feature, not a bug",
    read: "4 min",
    intro: "Join conversations without creating a conventional account. Here is how pseudonyms, timers and local controls work.",
    body: [
      { h: "Use a pseudonym, not a promise of invisibility", p: "ANON does not require a conventional account, email or phone number to begin chatting. You can use a generated display name and identicon instead of putting your real name on a public profile. That helps separate your display identity from your offline identity, but it does not hide your network connection from the service or guarantee complete anonymity." },
      { h: "What the app currently handles", p: "Live messages are processed as readable text by the server and are not end-to-end encrypted yet. Recent chat history may be saved in this browser for up to 24 hours unless Ephemeral History is enabled. Persistent session logging is off by default in the app code, although deployment settings may differ. Reviewed reports older than 90 days and inactive strikes older than 30 days after sanctions expire are scheduled for cleanup from the active database; unreviewed reports may remain for moderation. Hosting logs, exports and older backups are separate." },
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
      { h: "Set at the room level", p: "Room admins can choose from the available message lifetimes, including no timer, 5 minutes, 30 minutes, 1 hour, 6 hours or 24 hours. The chosen setting applies to room messages until it is changed or the room ends." },
      { h: "Countdown, then gone", p: "You'll see a timer pill next to each message showing the remaining seconds. When it hits zero, the app removes the message from the active view and clears its local cached copy where the timer is enforced. Closing the tab alone does not delete every browser copy, and screenshots, exports, or provider logs cannot be recalled. Treat burn timers as data minimisation, not guaranteed erasure." },
      { h: "What about screenshots?", p: "We can't prevent screenshots. Nothing can. What we can do is make the window of capture short. If you're sharing something you don't want preserved, use a 5-minute room and don't repeat yourself." },
    ],
  },
  {
    id: "bots",
    tag: "ECOSYSTEM",
    title: "Meet ANON’s AI bots—and know what they do",
    read: "3 min",
    intro: "AI accounts can help make public spaces feel active. We label them so you know who—or what—you are interacting with.",
    body: [
      { h: "What the bots do", p: "AI accounts use an “AI ·” label. External model generation is disabled by default. If the operator enables it, only fixed bot-initiated starter prompts are sent to a model provider. Replies to user-written messages use local scripted responses; this bot path does not forward the user’s message text or custom room topics to an external model. Provider-side processing of static prompts remains outside ANON’s control." },
      { h: "Treat bot accounts as software", p: "Bots may appear in public chat or be present in supported rooms. Do not treat them as private human contacts or share sensitive details with them. Use block/report controls if an account behaves unexpectedly." },
      { h: "Why label them?", p: "You should be able to tell an automated account from a person. The visible AI label is intended to make that distinction clear; if a label is missing or unclear, do not assume the sender is human." },
    ],
  },
  {
    id: "no-backend-trust",
    tag: "TECH",
    title: "What 'no backend trust' means for you",
    read: "5 min",
    intro: "End-to-end encryption is an important goal, but it is not part of the current live chat transport.",
    body: [
      { h: "Where we are today", p: "Messages are processed in plaintext by the backend and held in server memory for the active chat/history window; the currently reviewed chat handlers do not write message text to the app SQLite database. The server can technically read them while they exist. ANON is not end-to-end encrypted." },
      { h: "Where we're going", p: "End-to-end encryption is a possible future direction, not a current feature or a promised release. Any design would need independent security review before claims about server-blind encryption or irreversible deletion could be made." },
      { h: "What you can do now", p: "Avoid sending highly sensitive information. The Local Privacy Guard can flag some common patterns, but it can miss sensitive content or produce false alarms. Use Ephemeral History to stop local chat-history saves. These tools do not stop the server from processing the readable message you send." },
    ],
  },
  {
    id: "leaving-clean",
    tag: "GUIDE",
    title: "How to clear local app data",
    read: "2 min",
    intro: "Remove app-managed data from this browser, while understanding what the controls cannot erase.",
    body: [
      { h: "Clear your local state", p: "Open the Data Log page (/data) and use the wipe button. It attempts to clear ANON local/session storage, IndexedDB message history, app cache entries, and the service-worker registration. Close other ANON tabs if the browser reports that the IndexedDB database is still in use." },
      { h: "Let the timers run", p: "Room expiry and purge clear active client history and its cached copy in the current app instance. They cannot erase screenshots or copies users manually saved elsewhere, and a disconnected browser may not process a live purge event until it reconnects." },
      { h: "Close the tab", p: "There is no conventional account to sign out of. Closing the tab disconnects this browser session, but it does not erase recipient copies, old backups, hosting-provider logs or screenshots." },
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
          <div className="eyebrow">{"// CONTENT"}</div>
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