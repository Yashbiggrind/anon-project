"use client";

import { useState } from "react";
import Link from "next/link";

const SECURITY_HEADERS_STATUS = `FRONTEND — anon-app/next.config.ts
Content-Security-Policy: CONFIGURED
script-src: 'self' 'unsafe-inline'
unsafe-eval: not allowed in production
frame-ancestors: 'none' (profile editor: same-origin exception)
Strict-Transport-Security: max-age=63072000; includeSubDomains
Permissions-Policy: camera=(), microphone=(), geolocation=()

BACKEND — anon-server/index.js
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer

Deployment response headers have not been live-verified.`;

const TOR_CODE = `# /etc/tor/torrc
HiddenServiceDir /var/lib/tor/anon/
HiddenServicePort 80 127.0.0.1:3000
HiddenServiceVersion 3
# same app, no logs on the onion side`;

const PG_CODE = `-- no users table. ever.
CREATE TABLE rooms (
  id text PRIMARY KEY,
  code text UNIQUE,
  mode text, cap int, life_s int
);
CREATE TABLE messages (
  id uuid PRIMARY KEY,
  room_id text REFERENCES rooms ON DELETE CASCADE,
  body bytea,       -- ciphertext only
  exp_at timestamptz NOT NULL
);
CREATE INDEX ON messages(exp_at);`;

export default function TrustPage() {
  const [rateHits, setRateHits] = useState<number[]>([]);
  const [encrypted, setEncrypted] = useState("");
  const [decrypted, setDecrypted] = useState("");
  const [plain, setPlain] = useState("meet at the usual place");
  const [code, setCode] = useState("LNG-482");

  // ---------- Rate limit visualizer ----------
  function fire(n: number) {
    const now = Date.now();
    const next = [...rateHits, ...Array(n).fill(now)].filter(t => now - t < 10000).slice(-24);
    setRateHits(next);
  }

  // ---------- WebCrypto E2E demo ----------
  async function runCrypto() {
    try {
      const enc = new TextEncoder();
      const keyMat = await crypto.subtle.importKey("raw", enc.encode(code), "PBKDF2", false, ["deriveKey"]);
      const key = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: enc.encode("anon-room-v1"), iterations: 100000, hash: "SHA-256" },
        keyMat, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
      );
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plain)));
      const combined = new Uint8Array(iv.length + ct.length);
      combined.set(iv); combined.set(ct, iv.length);
      const b64 = btoa(String.fromCharCode(...combined));
      setEncrypted(b64);

      const iv2 = combined.slice(0, 12);
      const dec = new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv2 }, key, combined.slice(12)));
      setDecrypted(dec);
    } catch {
      setEncrypted("WebCrypto unavailable");
      setDecrypted("");
    }
  }

  const rateFull = rateHits.length >= 15;
  const dots = Array.from({ length: 24 }, (_, i) => i < rateHits.length);

  return (
    <>
      <style>{CSS}</style>
      <div className="trustRoot">
        <div className="tHead">
          <div className="eyebrow">{"// TRUST LAYER"}</div>
          <h1>What we promise. What is live.</h1>
          <p>Status labels are honest: LIVE, READY, or PLANNED.</p>
          <Link href="/" className="backBtn">← Back to chat</Link>
        </div>

        <div className="tGrid">
          {/* ---------- Rate limits ---------- */}
          <div className="card">
            <span className="status live">LIVE IN PROTOTYPE</span>
            <h3>Rate limits</h3>
            <p>15 events per 10 seconds, per connection. Press the buttons and watch the bucket.</p>
            <div className="bucket">
              {dots.map((on, i) => (
                <i key={i} className={on ? (i < 15 ? "ok" : "no") : ""} />
              ))}
            </div>
            <div className="btnRow">
              <button className="btn sm" onClick={() => fire(1)}>FIRE EVENT</button>
              <button className="btn sm danger" onClick={() => fire(20)}>SPAM ×20</button>
            </div>
            <div className="note">
              {rateFull ? "429 · Too many events. Slow down." : `${rateHits.length} / 15 used in the last 10s`}
            </div>
          </div>

          {/* ---------- Ask admin to join ---------- */}
          <div className="card">
            <span className="status live">LIVE IN PROTOTYPE</span>
            <h3>Ask admin to join</h3>
            <p>Request-only rooms. The admin gets a banner and decides. Favourites remember approval.</p>
            <div className="btnRow">
              <Link href="/#explore" className="btn sm pri">TRY IT →</Link>
            </div>
          </div>

          {/* ---------- Delete my data ---------- */}
          <div className="card">
            <span className="status live">LIVE IN PROTOTYPE</span>
            <h3>Delete my data</h3>
            <p>The data page exports or clears local data stored by this browser on this device. It does not delete server-side reports, blocks, or connection logs; connection logs are retained for up to 180 days.</p>
            <div className="btnRow">
              <Link href="/data" className="btn sm">OPEN DATA LOG →</Link>
            </div>
          </div>

          {/* ---------- PWA install ---------- */}
          <div className="card">
            <span className="status live">LIVE IN PROTOTYPE</span>
            <h3>Install as an app</h3>
            <p>Home-screen install, full screen, no browser history.</p>
            <div className="btnRow">
              <button className="btn sm" onClick={() => alert("On Android Chrome: menu ⋮ → Install app. On iOS Safari: Share → Add to Home Screen.")}>SHOW INSTALL PROMPT</button>
            </div>
          </div>

          {/* ---------- Security headers ---------- */}
          <div className="card">
            <span className="status ready">CONFIGURED IN APP</span>
            <h3>Security headers</h3>
            <p>The Next.js app config defines a Content-Security-Policy and additional browser security headers. Production permits inline scripts for current Next.js rendering but does not permit unsafe-eval. The profile editor has a same-origin framing exception. Deployment response headers have not been independently checked live.</p>
            <pre className="code">{SECURITY_HEADERS_STATUS}</pre>
          </div>

          {/* ---------- AI participant data use ---------- */}
          <div className="card">
            <span className="status live">LIVE IN PROTOTYPE</span>
            <h3>AI participant data use</h3>
            <p>AI participants are labeled as bots. When one generates a reply, the latest relevant message from public chat or a room containing that bot may be sent to Pollinations, with OpenRouter as a fallback when configured. These are external services with their own data practices. Avoid sharing sensitive personal information in bot-enabled conversations. Operators can disable bot activity with the server setting ENABLE_BOTS=false.</p>
          </div>

          {/* ---------- E2E ---------- */}
          <div className="card">
            <span className="status planned">DEMO ONLY</span>
            <h3>Encryption demonstration</h3>
            <p>This browser-only WebCrypto example encrypts and decrypts the text entered below. It is not connected to ANON chat or private rooms, and it does not encrypt real messages in transit beyond HTTPS. Do not enter private information here.</p>
            <input className="inp" value={plain} onChange={(e) => setPlain(e.target.value)} placeholder="message to encrypt" />
            <input className="inp" value={code} onChange={(e) => setCode(e.target.value)} placeholder="room code" />
            <div className="btnRow">
              <button className="btn sm" onClick={runCrypto}>ENCRYPT → DECRYPT</button>
            </div>
            {encrypted && (
              <>
                <div className="encOut">
                  <span className="dim">server sees: </span>
                  <span className="enc">{encrypted.slice(0, 60)}…</span>
                </div>
                <div className="encOut">
                  <span className="dim">members see: </span>
                  <span className="ok">{decrypted}</span>
                </div>
                <div className="note">Demo. Real rollout needs per-member keys.</div>
              </>
            )}
          </div>

          {/* ---------- Tor ---------- */}
          <div className="card">
            <span className="status plan">PLANNED</span>
            <h3>Tor .onion mirror</h3>
            <p>A hidden-service twin of the site for network-level anonymity.</p>
            <pre className="code">{TOR_CODE}</pre>
          </div>

          {/* ---------- Postgres ---------- */}
          <div className="card">
            <span className="status plan">PLANNED</span>
            <h3>PostgreSQL</h3>
            <p>Durable rooms without durable people. No user table, ciphertext only.</p>
            <pre className="code">{PG_CODE}</pre>
          </div>
        </div>
      </div>
    </>
  );
}

const CSS = `
  .trustRoot{
    min-height:100vh;
    background:#040203;
    color:#e8dde2;
    padding:40px 20px 60px;
    font-family:'IBM Plex Mono','Courier New',monospace;
  }
  .tHead{
    max-width:1100px;
    margin:0 auto 32px;
    padding-bottom:24px;
    border-bottom:1px solid #2a0a12;
  }
  .eyebrow{
    font-size:10px;
    letter-spacing:3px;
    color:#ff2d55;
    font-weight:700;
    text-transform:uppercase;
    margin-bottom:8px;
  }
  .tHead h1{
    font-family:'Bodoni Moda','Times New Roman',serif;
    font-weight:900;
    font-size:clamp(28px, 5vw, 44px);
    letter-spacing:-.02em;
    margin:0 0 8px;
    color:#f4e8e8;
    text-wrap:balance;
  }
  .tHead p{
    color:#8a7276;
    font-size:13px;
    margin:0 0 16px;
  }
  .backBtn{
    display:inline-flex;
    align-items:center;
    gap:6px;
    color:#ff5875;
    font-size:11px;
    letter-spacing:2px;
    text-transform:uppercase;
    text-decoration:none;
    padding:8px 14px;
    border:1px solid #4a0a14;
    border-radius:6px;
    background:#160409;
    transition:all .2s;
  }
  .backBtn:hover{background:#22060d;border-color:#e11d48;color:#fff;}

  .tGrid{
    max-width:1100px;
    margin:0 auto;
    display:grid;
    grid-template-columns:repeat(auto-fit, minmax(300px, 1fr));
    gap:16px;
  }

  .card{
    padding:22px;
    background:linear-gradient(180deg,#0c0407,#060103);
    border:1px solid #25080f;
    border-radius:10px;
    display:flex;
    flex-direction:column;
    gap:12px;
    min-width:0;
  }

  .status{
    align-self:flex-start;
    padding:3px 10px;
    font-size:9px;
    letter-spacing:1.8px;
    font-weight:700;
    border:1px solid;
    border-radius:4px;
    text-transform:uppercase;
  }
  .status.live{color:#35d27c;border-color:rgba(53,210,124,.5);}
  .status.ready{color:#ffb352;border-color:rgba(255,179,82,.5);}
  .status.plan{color:#8a7276;border-color:#3a0a14;}

  .card h3{
    font-family:'Bodoni Moda',serif;
    font-weight:900;
    font-size:22px;
    letter-spacing:-.02em;
    margin:0;
    color:#f4e8e8;
  }
  .card p{
    color:#8a7276;
    font-size:12.5px;
    line-height:1.6;
    margin:0;
  }

  .bucket{
    display:grid;
    grid-template-columns:repeat(24, 1fr);
    gap:3px;
    margin:4px 0;
  }
  .bucket i{
    aspect-ratio:1;
    border:1px solid #2a0a12;
    background:#0a0205;
    transition:all .2s;
  }
  .bucket i.ok{
    background:rgba(53,210,124,.6);
    border-color:#35d27c;
    box-shadow:0 0 8px rgba(53,210,124,.6);
  }
  .bucket i.no{
    background:rgba(255,45,85,.7);
    border-color:#ff2d55;
    box-shadow:0 0 8px rgba(255,45,85,.7);
  }

  .btnRow{display:flex;gap:8px;flex-wrap:wrap;}
  .btn{
    display:inline-flex;
    align-items:center;
    gap:6px;
    padding:8px 14px;
    background:#160409;
    border:1px solid #4a0a14;
    border-radius:6px;
    color:#ff5875;
    font-family:inherit;
    font-size:10.5px;
    letter-spacing:1.6px;
    font-weight:700;
    text-transform:uppercase;
    text-decoration:none;
    cursor:pointer;
    transition:all .2s;
  }
  .btn:hover{background:#22060d;border-color:#e11d48;color:#fff;}
  .btn.pri{background:linear-gradient(180deg,#6a0a18,#3a0510);border-color:#ff2d55;color:#fff;}
  .btn.danger{border-color:#ff2d55;color:#ff5875;}

  .code{
    padding:12px;
    background:#050102;
    border:1px solid #2a0a12;
    border-radius:6px;
    color:#d4a8b3;
    font-size:10.5px;
    line-height:1.55;
    overflow-x:auto;
    white-space:pre;
    font-family:'IBM Plex Mono',monospace;
    max-height:220px;
    margin:0;
  }

  .inp{
    width:100%;
    padding:10px 12px;
    background:#0a0205;
    border:1px solid #2a0a12;
    border-radius:6px;
    color:#f4e8e8;
    font-family:inherit;
    font-size:13px;
    outline:0;
    transition:border-color .2s,box-shadow .2s;
  }
  .inp:focus{border-color:#7a0a1c;box-shadow:0 0 15px -6px #e11d48;}

  .encOut{
    font-size:11px;
    word-break:break-all;
    line-height:1.5;
    font-family:'IBM Plex Mono',monospace;
  }
  .encOut .dim{color:#7c5a63;}
  .encOut .enc{color:#ff5875;}
  .encOut .ok{color:#7dffa8;}

  .note{
    font-size:10.5px;
    color:#5a4048;
    font-style:italic;
    margin-top:6px;
  }

  @media (max-width: 640px) {
    .trustRoot{min-height:100dvh;padding:22px 12px calc(56px + env(safe-area-inset-bottom));}
    .tHead{margin-bottom:20px;padding-bottom:17px;}
    .eyebrow{font-size:9px;letter-spacing:2px;}
    .tHead h1{font-size:clamp(29px,8vw,38px);line-height:1.08;}
    .tHead p{font-size:12px;line-height:1.65;}
    .backBtn{min-height:40px;padding:9px 12px;font-size:10px;letter-spacing:1.3px;}
    .tGrid{grid-template-columns:minmax(0,1fr);gap:11px;}
    .card{min-width:0;padding:15px;border-radius:9px;gap:10px;}
    .card h3{font-size:20px;line-height:1.25;overflow-wrap:anywhere;}
    .card p{font-size:12px;line-height:1.65;overflow-wrap:anywhere;}
    .status{font-size:8px;letter-spacing:1.4px;}
    .bucket{grid-template-columns:repeat(12,minmax(0,1fr));gap:4px;}
    .bucket i{min-width:0;}
    .btnRow{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;}
    .btnRow .btn{min-width:0;min-height:40px;justify-content:center;padding:9px 7px;font-size:9px;letter-spacing:.8px;white-space:normal;line-height:1.3;}
    .code{max-width:100%;font-size:9px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;}
    .inp{min-height:42px;font-size:16px;}
    .encOut{font-size:10px;overflow-wrap:anywhere;word-break:break-word;}
    .note{font-size:10px;line-height:1.6;}
  }
  @media (max-width: 360px) {
    .trustRoot{padding-left:9px;padding-right:9px;}
    .card{padding:12px;}
    .btnRow{grid-template-columns:minmax(0,1fr);}
    .bucket{gap:3px;}
  }
`;