"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const LS_KEY = "anon_privacy_note_seen_v2";

export default function ConsentBanner() {
  const [show, setShow] = useState(false);
  const [ready, setReady] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        if (!localStorage.getItem(LS_KEY)) setShow(true);
      } catch {
        // Keep the privacy note available in restricted-storage browser modes.
        setShow(true);
      }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const continueToApp = () => {
    try { localStorage.setItem(LS_KEY, String(Date.now())); } catch {}
    setShow(false);
  };

  if (!ready || !show) return null;

  return (
    <>
      <style>{CSS}</style>
      <div className="consentRoot">
        <section className="consentCard" role="region" aria-label="ANON privacy note">
          <div className="consentMark" aria-hidden="true">A<span>·</span></div>
          <div className="consentText">
            <div className="consentTitle">A QUICK PRIVACY NOTE</div>
            <p className="consentBody">
              ANON lets you use a pseudonym, but it does not make you untraceable.
              Live messages are readable by the server and are <strong>not yet end-to-end encrypted</strong>.
              Share only what you are comfortable with.
            </p>
            <button
              className="consentDetailsToggle"
              type="button"
              onClick={() => setDetailsOpen((open) => !open)}
              aria-expanded={detailsOpen}
              aria-controls="anon-privacy-note-details"
            >
              {detailsOpen ? "Hide data details" : "How data is handled"}
              <span aria-hidden="true">{detailsOpen ? "−" : "+"}</span>
            </button>
            {detailsOpen && (
              <div className="consentDetails" id="anon-privacy-note-details">
                <p>
                  <strong>Browser data:</strong> recent message history may be cached locally for up to 24 hours.
                  Ephemeral History clears that cache and stops new local history saves.
                </p>
                <p>
                  <strong>Safety records:</strong> reviewed reports older than 90 days and inactive strikes older
                  than 30 days after cooldown/ban expiry are scheduled for cleanup from the active app database.
                  Unreviewed reports may remain for moderation.
                </p>
                <p>
                  <strong>Connection logs and providers:</strong> persistent session logging is off by default in
                  the app code, but deployment settings and infrastructure logs may differ. External AI generation
                  is off by default; when enabled, the current bot path sends only fixed starter prompts—not your
                  written chat messages—to model providers.
                </p>
                <p>
                  These controls do not erase screenshots, recipient copies, hosting logs or old backups.
                  See the <Link href="/privacy-center">Privacy Center</Link> for details.
                </p>
              </div>
            )}
            <div className="consentLinks" aria-label="Privacy and policy links">
              <Link href="/privacy-center" className="consentLink">Privacy center</Link>
              <span className="consentSep">·</span>
              <Link href="/legal/privacy" className="consentLink">Privacy policy</Link>
              <span className="consentSep">·</span>
              <Link href="/legal/terms" className="consentLink">Terms</Link>
              <span className="consentSep">·</span>
              <Link href="/data" className="consentLink">Local data controls</Link>
            </div>
          </div>
          <button className="consentBtn" onClick={continueToApp}>
            Continue to ANON <span aria-hidden="true">↗</span>
          </button>
        </section>
      </div>
    </>
  );
}

const CSS = `
  .consentRoot{
    position:fixed;left:0;right:0;bottom:0;z-index:9999;
    padding:16px 20px max(18px,env(safe-area-inset-bottom));
    display:flex;justify-content:center;pointer-events:none;
    animation:consentIn .32s cubic-bezier(.2,.8,.2,1) both;animation-delay:.25s;
  }
  @keyframes consentIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
  .consentCard{
    pointer-events:auto;width:min(900px,100%);display:flex;align-items:flex-start;gap:16px;
    padding:18px;background:linear-gradient(145deg,rgba(17,11,15,.98),rgba(7,5,7,.985));
    border:1px solid #3a2831;border-top:2px solid #e14568;border-radius:16px;
    box-shadow:0 18px 60px rgba(0,0,0,.52);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
  }
  .consentMark{flex:none;width:38px;height:38px;display:grid;place-items:center;border:1px solid #5d3040;border-radius:12px;background:#1e0c13;color:#ffe8ee;font:800 17px ui-monospace,monospace}
  .consentMark span{color:#ff5a7b}
  .consentText{flex:1;min-width:0}
  .consentTitle{font:750 10px ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.17em;color:#ff849b;margin-bottom:7px}
  .consentBody{margin:0;color:#d6c6cd;font:13px/1.65 Inter,ui-sans-serif,system-ui,sans-serif;max-width:730px}
  .consentBody strong{color:#fff0f4;font-weight:750}
  .consentDetailsToggle{display:inline-flex;align-items:center;gap:8px;margin-top:8px;padding:3px 0;background:none;border:0;color:#ff9bad;font:650 11px Inter,ui-sans-serif,system-ui,sans-serif;cursor:pointer}
  .consentDetailsToggle:hover{text-decoration:underline}
  .consentDetails{margin-top:10px;padding:12px 13px;border:1px solid #302129;border-radius:10px;background:rgba(2,1,3,.36);color:#b9a8b0;font:11.5px/1.7 Inter,ui-sans-serif,system-ui,sans-serif}
  .consentDetails p{margin:0 0 7px}.consentDetails p:last-child{margin-bottom:0}
  .consentDetails strong{color:#eadbe1}.consentDetails a{color:#ff9bad;text-underline-offset:3px}
  .consentLinks{display:flex;flex-wrap:wrap;gap:7px;align-items:center;margin-top:11px;font:600 10px Inter,ui-sans-serif,system-ui,sans-serif}
  .consentLink{color:#a9959e;text-decoration:none;transition:color .15s}.consentLink:hover{color:#fff0f4;text-decoration:underline;text-underline-offset:3px}
  .consentSep{color:#57404a}
  .consentBtn{flex:none;display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:42px;padding:0 15px;background:linear-gradient(135deg,#e83a61,#941631);border:1px solid #ff6484;border-radius:10px;color:#fff;font:750 11px Inter,ui-sans-serif,system-ui,sans-serif;white-space:nowrap;cursor:pointer;transition:transform .16s,filter .16s}
  .consentBtn:hover{filter:brightness(1.12);transform:translateY(-1px)}.consentBtn:focus-visible,.consentDetailsToggle:focus-visible,.consentLink:focus-visible{outline:2px solid #ff9bad;outline-offset:3px}
  @media(max-width:700px){.consentRoot{padding:10px 10px max(12px,env(safe-area-inset-bottom))}.consentCard{display:grid;grid-template-columns:34px minmax(0,1fr);gap:10px;padding:13px;border-radius:14px}.consentMark{width:32px;height:32px;border-radius:9px;font-size:14px}.consentText{grid-column:2}.consentTitle{font-size:9px}.consentBody{font-size:12px;line-height:1.55}.consentBtn{grid-column:1 / -1;width:100%;min-height:42px}.consentDetails{font-size:11px}.consentLinks{font-size:9.5px}}
  @media(prefers-reduced-motion:reduce){.consentRoot{animation:none}.consentBtn{transition:none}}
`;
