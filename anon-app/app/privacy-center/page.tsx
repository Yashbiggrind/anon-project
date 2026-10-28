"use client";

import Link from "next/link";
import { useState } from "react";

const CSS = `
  .pc-root{min-height:100vh;background:#050305;color:#eee5e9;padding:34px 18px 72px;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  .pc-wrap{max-width:1120px;margin:0 auto}
  .pc-top{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:28px}
  .pc-brand{color:#ff4269;font:700 11px ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.2em;text-transform:uppercase}
  .pc-link{display:inline-flex;align-items:center;gap:8px;color:#f4dfe5;text-decoration:none;border:1px solid #47202d;background:#140a0f;border-radius:999px;padding:10px 14px;font-size:12px}
  .pc-link:hover{border-color:#ff4269}
  .pc-hero{padding:clamp(24px,5vw,48px);border:1px solid #42202b;border-radius:24px;background:radial-gradient(ellipse at 90% 0%,rgba(225,29,72,.16),transparent 42%),linear-gradient(135deg,#160b11,#090609 70%);box-shadow:0 25px 90px rgba(0,0,0,.24)}
  .pc-kicker{font:700 10px ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.2em;text-transform:uppercase;color:#ff6a88}
  .pc-hero h1{font-size:clamp(32px,5vw,56px);line-height:1.02;letter-spacing:-.055em;margin:14px 0 16px;max-width:780px}
  .pc-hero p{max-width:760px;color:#c7b6bd;line-height:1.75;margin:0}
  .pc-alert{margin-top:24px;border:1px solid #8b273e;background:#260b14;border-radius:14px;padding:16px 18px;display:flex;gap:12px;align-items:flex-start}
  .pc-alert strong{display:block;color:#ff8da5;font-size:13px;margin-bottom:5px}
  .pc-alert p{font-size:13px;color:#e4cbd3;line-height:1.65}
  .pc-meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}
  .pc-chip{border:1px solid #3d2730;background:#100b0e;border-radius:999px;padding:7px 10px;color:#c8b8be;font-size:11px}
  .pc-section{margin-top:34px}
  .pc-section-head{display:flex;align-items:end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}
  .pc-section h2{font-size:21px;letter-spacing:-.03em;margin:0}
  .pc-section-head p{font-size:12px;color:#9c8a92;margin:0}
  .pc-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
  .pc-card{border:1px solid #2b2025;border-radius:16px;padding:19px;background:linear-gradient(145deg,#100b0e,#090709);min-width:0}
  .pc-card h3{margin:12px 0 8px;font-size:16px;letter-spacing:-.02em}
  .pc-card p{margin:0;color:#b8a9af;font-size:13px;line-height:1.7}
  .pc-status{display:inline-flex;border-radius:6px;padding:5px 7px;font:700 9px ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.08em}
  .pc-verified{color:#9de6c4;background:#10261c;border:1px solid #1d5a3e}
  .pc-gap{color:#ff9bad;background:#2a0c15;border:1px solid #7d293f}
  .pc-planned{color:#e3c6ff;background:#21152d;border:1px solid #57376d}
  .pc-note{color:#998891;font-size:11px;line-height:1.6;margin-top:14px}
  .pc-table-wrap{overflow-x:auto;border:1px solid #2b2025;border-radius:14px}
  .pc-table{width:100%;border-collapse:collapse;min-width:650px}
  .pc-table th,.pc-table td{text-align:left;padding:14px 16px;border-bottom:1px solid #251a1f;font-size:12px;line-height:1.65;vertical-align:top}
  .pc-table th{background:#110a0e;color:#f3c4d0;font-size:10px;text-transform:uppercase;letter-spacing:.1em}
  .pc-table td{color:#bfafb6}
  .pc-table tr:last-child td{border-bottom:0}
  .pc-table td:first-child{color:#eee1e6;font-weight:650;width:24%}
  .pc-checks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
  .pc-check{border:1px solid #2e2328;background:#0d090c;border-radius:11px;padding:12px;display:flex;gap:10px;align-items:flex-start;color:#cdbdc3;font-size:12px;line-height:1.55}
  .pc-check input{accent-color:#ff4269;margin-top:2px}
  .pc-foot{margin-top:34px;border-top:1px solid #35212a;padding-top:20px;color:#94828a;font-size:11px;line-height:1.8}
  @media(max-width:720px){.pc-grid,.pc-checks{grid-template-columns:1fr}.pc-hero{border-radius:17px}.pc-root{padding-inline:12px}.pc-card{padding:16px}}
`;

const checks = [
  "Map every live Socket.IO event to the data it receives and returns.",
  "Adopt a reviewed E2EE protocol/library; no custom cryptography.",
  "Keep private-message plaintext out of server handlers, logs, queues and telemetry.",
  "Design authenticated key exchange, per-device keys and key-change warnings.",
  "Review image/attachment encryption and metadata leakage.",
  "Add cross-client test vectors, tampering tests and negative tests.",
  "Test room membership changes, removed members and old-key access.",
  "Review deletion, encrypted local storage and backup recovery.",
  "Redesign moderation so private-message inspection is not required.",
  "Document legal retention, deletion evidence, hosting logs and incident response.",
  "Independent security review before any E2EE claim.",
  "Publish a versioned threat model and security contact."
];

export default function PrivacyCenterPage() {
  const [done, setDone] = useState<boolean[]>(checks.map(() => false));
  const completed = done.filter(Boolean).length;

  return (
    <>
      <style>{CSS}</style>
      <main className="pc-root">
        <div className="pc-wrap">
          <nav className="pc-top" aria-label="Privacy navigation">
            <div className="pc-brand">ANON // PRIVACY CONTROL ROOM</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <Link className="pc-link" href="/trust">← Trust layer</Link>
              <Link className="pc-link" href="/">Back to ANON ↗</Link>
            </div>
          </nav>

          <section className="pc-hero">
            <div className="pc-kicker">Transparency before promises</div>
            <h1>Know what stays private.<br/>Know what does not.</h1>
            <p>This page is a source-review snapshot of ANON&apos;s public repository, not a live network scanner, independent audit, or proof of deployed production settings. It is intentionally explicit about current gaps.</p>
            <div className="pc-alert" role="alert">
              <div aria-hidden="true" style={{fontSize:22}}>⚠</div>
              <div>
                <strong>Important: live chat is not verified as end-to-end encrypted.</strong>
                <p>The inspected server code receives readable message content in chat handlers. HTTPS protects transport, but it does not prevent the server from reading plaintext. Do not use the current build for highly sensitive secrets or assume the service operator cannot read private chat.</p>
              </div>
            </div>
            <div className="pc-meta">
              <span className="pc-chip">Reviewed source snapshot: 28 Oct 2026</span>
              <span className="pc-chip">Scope: public GitHub main branch</span>
              <span className="pc-chip">Not an independent audit</span>
            </div>
          </section>

          <section className="pc-section">
            <div className="pc-section-head">
              <h2>Current source-review status</h2>
              <p>“Present in code” is not the same as “independently verified.”</p>
            </div>
            <div className="pc-grid">
              <article className="pc-card">
                <span className="pc-status pc-verified">PRESENT IN CODE</span>
                <h3>No conventional sign-up flow</h3>
                <p>The inspected socket connection creates a session and generates a pseudonymous display name when no valid custom name is supplied. This reduces the need to disclose a real name, phone number or email to other users.</p>
              </article>
              <article className="pc-card">
                <span className="pc-status pc-gap">SECURITY GAP</span>
                <h3>Plaintext reaches the server</h3>
                <p>At least the inspected public-chat and direct-message paths handle readable content server-side. The isolated WebCrypto sample on the Trust page does not encrypt those live paths.</p>
              </article>
              <article className="pc-card">
                <span className="pc-status pc-verified">PRESENT IN CODE</span>
                <h3>Network metadata is recorded</h3>
                <p>The SQLite schema records a keyed IP hash, session ID, connection/disconnection timestamps and a truncated user-agent. The code sets a 180-day retention window and calls a purge routine. A keyed hash can still support correlation.</p>
              </article>
              <article className="pc-card">
                <span className="pc-status pc-gap">NOT THE SAME AS ANONYMITY</span>
                <h3>Anti-abuse records can persist</h3>
                <p>Reports and spam-strike records are persisted. These can support safety operations, but their identifiers, access controls, retention and deletion policy need a documented privacy review.</p>
              </article>
              <article className="pc-card">
                <span className="pc-status pc-verified">PRESENT IN CODE</span>
                <h3>Some content has expiry rules</h3>
                <p>The inspected server defines bounded lifetimes for public history, direct-message threads and confessions. Expiry in the app cannot delete screenshots, copies, device backups or external records.</p>
              </article>
              <article className="pc-card">
                <span className="pc-status pc-planned">NOT VERIFIED</span>
                <h3>Local history and hosting copies</h3>
                <p>This page does not verify browser storage on a real device, hosting-provider logs, CDN records, backups, deployment configuration or what any external AI provider retains. These require separate operational checks.</p>
              </article>
            </div>
            <p className="pc-note">Source files reviewed: anon-server/index.js, anon-server/db.js and anon-app/app/trust/page.tsx on the public main branch. Production deployment behaviour can differ from repository code.</p>
          </section>

          <section className="pc-section">
            <div className="pc-section-head">
              <h2>Who can see what?</h2>
              <p>High-level explanation; exact deployment settings must be tested.</p>
            </div>
            <div className="pc-table-wrap">
              <table className="pc-table">
                <thead><tr><th>Data type</th><th>Other users</th><th>ANON server / operator</th><th>What to improve</th></tr></thead>
                <tbody>
                  <tr><td>Public chat and confession posts</td><td>Intended to be visible according to the feature&apos;s public feed/room rules.</td><td>Readable content reaches server-side handlers.</td><td>Label public content clearly; warn before posting identifiers; define moderation and deletion policy.</td></tr>
                  <tr><td>Private message content</td><td>Intended recipients.</td><td>Readable content is handled by inspected server paths; E2EE is not established.</td><td>Encrypt on sender devices with a reviewed protocol; server should relay ciphertext only.</td></tr>
                  <tr><td>Network metadata</td><td>Not normally displayed as a profile field.</td><td>Keyed IP hash and session metadata are stored for operations/abuse handling.</td><td>Minimise fields, restrict access, test 180-day purge, document legal obligations and deletion limits.</td></tr>
                  <tr><td>AI bot conversations</td><td>Depends on where the bot is added.</td><td>Actual routing/provider behaviour needs a separate audit.</td><td>Make bot presence conspicuous; ask consent before external processing; disclose provider retention and avoid sending hidden identity metadata.</td></tr>
                  <tr><td>Disappearing content</td><td>May remain in screenshots or a recipient&apos;s copies.</td><td>Server-side expiry needs verification per message type and persistence path.</td><td>Test deletion on every layer; never promise global erasure from all recipients and backups.</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="pc-section">
            <div className="pc-section-head">
              <h2>Security release gate</h2>
              <p>{completed}/{checks.length} review tasks marked complete in this browser</p>
            </div>
            <p style={{color:"#a9959e",fontSize:12,lineHeight:1.7,margin:"0 0 14px"}}>This checklist is a local planning aid only. Ticking a box does not change code, certify security or persist completion to a server.</p>
            <div className="pc-checks">
              {checks.map((check, index) => (
                <label className="pc-check" key={check}>
                  <input type="checkbox" checked={done[index]} onChange={event => setDone(old => old.map((value, i) => i === index ? event.target.checked : value))}/>
                  <span>{check}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="pc-section">
            <div className="pc-section-head">
              <h2>Planned privacy differentiators</h2>
              <p>Not implemented simply because listed here.</p>
            </div>
            <div className="pc-grid">
              <article className="pc-card"><span className="pc-status pc-planned">PLANNED</span><h3>Per-room identity cloak</h3><p>Use unrelated aliases across rooms, with no universal public identifier. Design anti-abuse controls so they do not silently recreate cross-room tracking.</p></article>
              <article className="pc-card"><span className="pc-status pc-planned">PLANNED</span><h3>On-device AI Privacy Shield</h3><p>Optional local warnings for suspicious links or accidental personal information. Keep analysis local where practical; never silently upload message text to an AI provider.</p></article>
              <article className="pc-card"><span className="pc-status pc-planned">PLANNED</span><h3>Bounded-context AI bots</h3><p>Explicit user consent, clear AI labels and a strict conversation-level context boundary. Do not expose other rooms, hidden identity data or unrelated message history.</p></article>
              <article className="pc-card"><span className="pc-status pc-planned">PLANNED</span><h3>Privacy proof and expiry receipts</h3><p>Publish a threat model, review record, retention details and deletion evidence. Receipts must describe what the service deleted—not promise that all external copies vanished.</p></article>
            </div>
          </section>

          <footer className="pc-foot">
            ANON privacy is a work in progress. This page deliberately avoids claiming “zero logs,” “untraceable,” “military-grade,” or “end-to-end encrypted” without evidence. Security claims should match code, deployed configuration and independent review.
            <br/><br/>
            <Link href="/trust" className="pc-link">Open Trust Layer →</Link>
          </footer>
        </div>
      </main>
    </>
  );
}
