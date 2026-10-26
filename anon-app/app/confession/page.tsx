"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Identicon from "@/components/Identicon";

type Confession = {
  id: string;
  text: string;
  author: string;
  createdAt: number;
  expiresAt: number;
  up: number;
  down: number;
  myVote: 0 | 1 | -1;
};

const LS_KEY = "anon.confessions.v1";
const SESSION_KEY = "anon.confession.session";
const TTL = 24 * 60 * 60 * 1000;
const MAX_LEN = 280;

function loadStore(): Confession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Confession[];
    return arr.filter((c) => c.expiresAt > Date.now());
  } catch { return []; }
}

function saveStore(list: Confession[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch {}
}

function getSession(): string {
  if (typeof window === "undefined") return "anon";
  let s = localStorage.getItem(SESSION_KEY);
  if (!s) {
    const adj = ["Silent","Velvet","Crimson","Hollow","Neon","Lunar","Iron","Ghost","Static","Quiet"];
    const noun = ["Crow","Wolf","Moth","Heron","Viper","Lynx","Owl","Bat","Fox","Raven"];
    s = adj[(Math.random()*adj.length)|0] + noun[(Math.random()*noun.length)|0] + (100 + (Math.random()*900|0));
    localStorage.setItem(SESSION_KEY, s);
  }
  return s;
}

export default function ConfessionPage() {
  const [list, setList] = useState<Confession[]>([]);
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState<"new" | "top" | "hot">("new");
  const [me, setMe] = useState<string>("anon");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setMe(getSession());
    setList(loadStore());
    setReady(true);
    const t = setInterval(() => {
      const next = loadStore();
      setList(next);
    }, 15000);
    return () => clearInterval(t);
  }, []);

  function persist(next: Confession[]) {
    setList(next);
    saveStore(next);
  }

  function post() {
    const text = draft.trim();
    if (!text || text.length > MAX_LEN) return;
    const now = Date.now();
    const c: Confession = {
      id: crypto.randomUUID(),
      text,
      author: me,
      createdAt: now,
      expiresAt: now + TTL,
      up: 0,
      down: 0,
      myVote: 0,
    };
    persist([c, ...list]);
    setDraft("");
  }

  function vote(id: string, dir: 1 | -1) {
    const next = list.map((c) => {
      if (c.id !== id) return c;
      let { up, down, myVote } = c;
      if (myVote === dir) {
        if (dir === 1) up--; else down--;
        myVote = 0;
      } else {
        if (myVote === 1) up--; if (myVote === -1) down--;
        if (dir === 1) up++; else down++;
        myVote = dir;
      }
      return { ...c, up, down, myVote: myVote as 0 | 1 | -1 };
    });
    persist(next);
  }

  const sorted = useMemo(() => {
    const now = Date.now();
    const arr = [...list];
    if (filter === "new") arr.sort((a, b) => b.createdAt - a.createdAt);
    if (filter === "top") arr.sort((a, b) => (b.up - b.down) - (a.up - a.down));
    if (filter === "hot") {
      arr.sort((a, b) => {
        const sa = (a.up - a.down) / Math.pow((now - a.createdAt) / 3600000 + 2, 1.5);
        const sb = (b.up - b.down) / Math.pow((now - b.createdAt) / 3600000 + 2, 1.5);
        return sb - sa;
      });
    }
    return arr;
  }, [list, filter]);

  function timeLeft(ts: number) {
    const ms = ts - Date.now();
    if (ms <= 0) return "expired";
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="cwRoot">
        <div className="cwHead">
          <div className="eyebrow">{"// CONFESSION WALL"}</div>
          <h1>Say it. Then it disappears.</h1>
          <p>Local-only preview. Posts stay in this browser and expire after 24 hours; this is not the shared Confession Wall.</p>
          <Link href="/" className="backBtn">← Back to chat</Link>
        </div>

        {ready && (
          <div className="composer">
            <textarea
              className="ta"
              placeholder="Type your confession… (280 max)"
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, MAX_LEN))}
              rows={3}
            />
            <div className="compFoot">
              <div className="who">
                <Identicon name={me} size={22} />
                <span>{me}</span>
              </div>
              <div className="compRight">
                <span className="counter">{draft.length}/{MAX_LEN}</span>
                <button className="btn pri" onClick={post} disabled={!draft.trim()}>
                  POST →
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="tabs">
          {(["new","hot","top"] as const).map((k) => (
            <button
              key={k}
              className={"tab " + (filter === k ? "on" : "")}
              onClick={() => setFilter(k)}
            >
              {k.toUpperCase()}
            </button>
          ))}
          <span className="count">{sorted.length} live</span>
        </div>

        <div className="feed">
          {sorted.length === 0 && (
            <div className="empty">Nothing yet. Be the first.</div>
          )}
          {sorted.map((c) => (
            <div className="post" key={c.id}>
              <div className="voteCol">
                <button
                  className={"vbtn " + (c.myVote === 1 ? "onUp" : "")}
                  onClick={() => vote(c.id, 1)}
                  aria-label="upvote"
                >▲</button>
                <span className="score">{c.up - c.down}</span>
                <button
                  className={"vbtn " + (c.myVote === -1 ? "onDown" : "")}
                  onClick={() => vote(c.id, -1)}
                  aria-label="downvote"
                >▼</button>
              </div>
              <div className="bodyCol">
                <div className="postHead">
                  <Identicon name={c.author} size={20} />
                  <span className="author">{c.author}</span>
                  <span className="dot">·</span>
                  <span className="ttl">{timeLeft(c.expiresAt)}</span>
                </div>
                <div className="text">{c.text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

const CSS = `
  .cwRoot{min-height:100vh;background:#040203;color:#e8dde2;padding:40px 20px 80px;font-family:'IBM Plex Mono','Courier New',monospace;}
  .cwHead{max-width:760px;margin:0 auto 28px;padding-bottom:22px;border-bottom:1px solid #2a0a12;}
  .eyebrow{font-size:10px;letter-spacing:3px;color:#ff2d55;font-weight:700;text-transform:uppercase;margin-bottom:8px;}
  .cwHead h1{font-family:'Bodoni Moda','Times New Roman',serif;font-weight:900;font-size:clamp(28px,5vw,44px);letter-spacing:-.02em;margin:0 0 8px;color:#f4e8e8;}
  .cwHead p{color:#8a7276;font-size:13px;margin:0 0 16px;}
  .backBtn{display:inline-flex;align-items:center;gap:6px;color:#ff5875;font-size:11px;letter-spacing:2px;text-transform:uppercase;text-decoration:none;padding:8px 14px;border:1px solid #4a0a14;border-radius:6px;background:#160409;transition:all .2s;}
  .backBtn:hover{background:#22060d;border-color:#e11d48;color:#fff;}

  .composer{max-width:760px;margin:0 auto 20px;background:linear-gradient(180deg,#0c0407,#060103);border:1px solid #25080f;border-radius:10px;padding:14px;}
  .ta{width:100%;background:#0a0205;border:1px solid #2a0a12;border-radius:8px;color:#f4e8e8;font-family:inherit;font-size:14px;padding:12px;outline:0;resize:vertical;min-height:70px;transition:border-color .2s,box-shadow .2s;}
  .ta:focus{border-color:#7a0a1c;box-shadow:0 0 15px -6px #e11d48;}
  .compFoot{display:flex;justify-content:space-between;align-items:center;margin-top:10px;gap:10px;flex-wrap:wrap;}
  .who{display:flex;align-items:center;gap:8px;color:#c9a8b1;font-size:12px;}
  .who svg{border-radius:5px;display:block;}
  .compRight{display:flex;align-items:center;gap:10px;}
  .counter{color:#5a4048;font-size:11px;}

  .btn{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:#160409;border:1px solid #4a0a14;border-radius:6px;color:#ff5875;font-family:inherit;font-size:10.5px;letter-spacing:1.6px;font-weight:700;text-transform:uppercase;text-decoration:none;cursor:pointer;transition:all .2s;}
  .btn:hover{background:#22060d;border-color:#e11d48;color:#fff;}
  .btn:disabled{opacity:.35;cursor:not-allowed;}
  .btn.pri{background:linear-gradient(180deg,#6a0a18,#3a0510);border-color:#ff2d55;color:#fff;}

  .tabs{max-width:760px;margin:0 auto 14px;display:flex;gap:8px;align-items:center;}
  .tab{padding:7px 14px;background:transparent;border:1px solid #2a0a12;border-radius:6px;color:#8a7276;font-family:inherit;font-size:10.5px;letter-spacing:1.6px;font-weight:700;cursor:pointer;transition:all .15s;}
  .tab:hover{color:#e8dde2;border-color:#4a0a14;}
  .tab.on{background:#160409;border-color:#e11d48;color:#fff;}
  .count{margin-left:auto;color:#5a4048;font-size:11px;letter-spacing:1px;}

  .feed{max-width:760px;margin:0 auto;display:flex;flex-direction:column;gap:10px;}
  .empty{text-align:center;color:#5a4048;padding:60px 20px;font-style:italic;font-size:13px;}

  .post{display:flex;gap:12px;background:linear-gradient(180deg,#0c0407,#060103);border:1px solid #25080f;border-radius:10px;padding:14px;transition:border-color .2s,transform .15s;}
  .post:hover{border-color:#3a0a14;}
  .voteCol{display:flex;flex-direction:column;align-items:center;gap:4px;flex:none;min-width:32px;}
  .vbtn{width:26px;height:26px;background:transparent;border:1px solid #2a0a12;border-radius:5px;color:#8a7276;font-size:11px;line-height:1;cursor:pointer;transition:all .15s;display:grid;place-items:center;font-family:inherit;}
  .vbtn:hover{border-color:#4a0a14;color:#e8dde2;}
  .vbtn.onUp{border-color:#35d27c;color:#35d27c;background:rgba(53,210,124,.08);}
  .vbtn.onDown{border-color:#ff2d55;color:#ff2d55;background:rgba(255,45,85,.08);}
  .score{font-size:12px;font-weight:700;color:#e8dde2;min-width:20px;text-align:center;}
  .bodyCol{flex:1;min-width:0;}
  .postHead{display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;}
  .postHead svg{border-radius:5px;display:block;flex:none;}
  .author{color:#c9a8b1;font-size:11.5px;font-weight:600;}
  .dot{color:#5a4048;}
  .ttl{color:#5a4048;font-size:10.5px;font-style:italic;}
  .text{color:#f4e8e8;font-size:14px;line-height:1.55;word-break:break-word;white-space:pre-wrap;}
`;