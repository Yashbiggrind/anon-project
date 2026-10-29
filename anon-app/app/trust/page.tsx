"use client";

import { useState } from "react";
import Link from "next/link";

const CSP_CODE = `// next.config.ts (Next.js)
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' ws: wss:",
  "object-src 'none'",
  "frame-ancestors 'none'",
].join("; ");

headers: [{ key: "Content-Security-Policy", value: csp }]`;

const TOR_CODE = `# /etc/tor/torrc
HiddenServiceDir /var/lib/tor/anon/
HiddenServicePort 80 127.0.0.1:3000
HiddenServiceVersion 3
# configure the application logging policy explicitly; onion routing alone does not disable app-level logging`;

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
  const [code, setCode] = useState("demo-only-phrase");

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
          <h1>Privacy is part of the experience.</h1>
          <p>Explore the controls and experiments behind ANON. We label examples clearly so you can see what each feature does.</p>
          <Link href="/privacy-center" className="backBtn">Open Privacy Control Room →</Link>
          <Link href="/" className="backBtn">← Back to chat</Link>
        </div>

        <div className="tGrid">
          {/* ---------- Rate limits ---------- */}
          <div className="card">
            <span className="status plan">LOCAL DEMO</span>
            <h3>Rate-limit visualizer</h3>
            <p>This card simulates a rolling 10-second counter in your browser. It does not send test traffic to the live server or measure production rate limits.</p>
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

          {/* ---------- Room-only identities ---------- */}
          <div className="card">
            <span className="status live">IN THIS BRANCH</span>
            <h3>Room-only identities</h3>
            <p>Private rooms show a room-specific alias and opaque member token, separate from public presence. This reduces direct cross-room identifier reuse; it does not encrypt messages or hide connection metadata from the server.</p>
            <div className="btnRow">
              <Link href="/privacy-center" className="btn sm pri">READ PRIVACY DETAILS →</Link>
            </div>
          </div>

          {/* ---------- Delete my data ---------- */}
          <div className="card">
            <span className="status live">IN THIS BRANCH</span>
            <h3>Local data controls</h3>
            <p>Review what this browser has saved, export a copy, or clear local data. Server-side safety records and recipients’ copies are separate.</p>
            <div className="btnRow">
              <Link href="/data" className="btn sm">OPEN LOCAL DATA CONTROLS →</Link>
            </div>
          </div>

          {/* ---------- PWA install ---------- */}
          <div className="card">
            <span className="status plan">INSTALL GUIDE</span>
            <h3>Add ANON to your home screen</h3>
            <p>These steps open your browser's install flow; they are not a native install prompt. Installing ANON does not erase browser history or other saved copies.</p>
            <div className="btnRow">
              <button className="btn sm" onClick={() => alert("Android Chrome: open menu ⋮ → Install app (if offered). iPhone/iPad Safari: Share → Add to Home Screen.")}>SHOW INSTALL STEPS</button>
            </div>
          </div>

          {/* ---------- CSP ---------- */}
          <div className="card">
            <span className="status plan">CONFIGURATION EXAMPLE</span>
            <h3>Security headers + CSP</h3>
            <p>An example policy for the engineering team to review and configure. This snippet alone does not prove the live deployment uses these headers.</p>
            <pre className="code">{CSP_CODE}</pre>
          </div>

          {/* ---------- E2E ---------- */}
          <div className="card">
            <span className="status plan">LOCAL DEMO</span>
            <h3>Local encryption illustration</h3>
            <p>See sample text turn into ciphertext and back in this browser. This isolated demo does not protect live chats, authenticate the other person, or provide secure key exchange. Use demo-only text and a demo-only phrase—never a real password or room code.</p>
            <label className="trustFieldLabel" htmlFor="local-encryption-sample">Sample text</label>
            <input id="local-encryption-sample" className="inp" value={plain} onChange={(e) => setPlain(e.target.value)} placeholder="demo text only" />
            <label className="trustFieldLabel" htmlFor="local-encryption-passphrase">Demo-only phrase</label>
            <input id="local-encryption-passphrase" className="inp" value={code} onChange={(e) => setCode(e.target.value)} placeholder="demo-only phrase" autoComplete="off" />
            <div className="btnRow">
              <button className="btn sm" onClick={runCrypto}>ENCRYPT → DECRYPT</button>
            </div>
            {encrypted && (
              <>
                <div className="encOut">
                  <span className="dim">encrypted sample: </span>
                  <span className="enc">{encrypted.slice(0, 60)}…</span>
                </div>
                <div className="encOut">
                  <span className="dim">decrypted locally: </span>
                  <span className="ok">{decrypted}</span>
                </div>
                <div className="note">Local learning demo only. A short or guessable phrase can be guessed; this is not a reviewed messaging protocol and does not test live-message encryption.</div>
              </>
            )}
          </div>

          {/* ---------- Tor ---------- */}
          <div className="card">
            <span className="status plan">PLANNED</span>
            <h3>Tor .onion mirror</h3>
            <p>Not deployed by this repository alone. A Tor onion service needs server/operator configuration and a separate review of network metadata. Onion routing by itself does not make users or app records untraceable.</p>
            <pre className="code">{TOR_CODE}</pre>
          </div>

          {/* ---------- Postgres ---------- */}
          <div className="card">
            <span className="status plan">PLANNED</span>
            <h3>PostgreSQL</h3>
            <p>A proposed storage direction, not the current database architecture. Ciphertext-only storage depends on a reviewed E2EE protocol and server-side integration, neither of which is live yet.</p>
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
  .trustFieldLabel{display:block;color:#b9a6af;font-size:11px;letter-spacing:.04em;margin:12px 0 6px}
  .trustFieldLabel + .inp{margin-top:0}
  .trustRoot :focus-visible{outline:2px solid #ff8199;outline-offset:3px}
  @media(prefers-reduced-motion:reduce){.trustRoot *{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
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
`;