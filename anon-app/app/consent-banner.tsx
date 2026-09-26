"use client";
import { useEffect, useState } from "react";

const LS_KEY = "anon_consent_v1";

export default function ConsentBanner() {
  const [show, setShow] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = localStorage.getItem(LS_KEY);
    if (!seen) setShow(true);
    setReady(true);
  }, []);

  const accept = () => {
    try {
      localStorage.setItem(LS_KEY, String(Date.now()));
    } catch {}
    setShow(false);
  };

  if (!ready || !show) return null;

  return (
    <>
      <style>{CSS}</style>
      <div className="consentRoot" role="dialog" aria-label="Consent notice">
        <div className="consentCard">
          <div className="consentText">
            <div className="consentTitle">BEFORE YOU STEP IN</div>
            <p className="consentBody">
              ANON doesn't ask for a name, email, or phone. To keep the room safe,
              we process a <b>hashed form</b> of your connection identifier for up to{" "}
              <b>180 days</b> — never your raw IP, never anything that identifies you.{" "}
              Nothing else is stored beyond your current session.
            </p>
            <div className="consentLinks">
              <a href="/legal/terms" className="consentLink">Terms</a>
              <span className="consentSep">·</span>
              <a href="/legal/privacy" className="consentLink">Privacy</a>
              <span className="consentSep">·</span>
              <a href="/legal/grievance" className="consentLink">Grievance</a>
            </div>
          </div>
          <button className="consentBtn" onClick={accept} aria-label="Accept and continue">
            I UNDERSTAND
          </button>
        </div>
      </div>
    </>
  );
}

const CSS = `
  .consentRoot{
    position:fixed;left:0;right:0;bottom:0;z-index:9999;
    padding:16px 20px 20px;
    display:flex;justify-content:center;
    pointer-events:none;
    animation:consentIn .45s cubic-bezier(.2,.8,.2,1) both;
    animation-delay:.6s;
  }
  @keyframes consentIn{
    from{opacity:0;transform:translateY(20px)}
    to{opacity:1;transform:none}
  }
  .consentCard{
    pointer-events:auto;
    width:min(820px,100%);
    display:flex;align-items:center;gap:20px;
    padding:16px 20px;
    background:linear-gradient(180deg, rgba(15,3,8,.96), rgba(5,1,2,.98));
    border:1px solid #3a0a14;
    border-left:3px solid #ff2d55;
    border-radius:10px;
    box-shadow:0 10px 40px -8px #000, 0 0 60px -20px rgba(225,29,72,.6);
    backdrop-filter:blur(10px);
    -webkit-backdrop-filter:blur(10px);
  }
  .consentText{flex:1;min-width:0}
  .consentTitle{
    font-family:'Courier New',monospace;
    font-size:10px;letter-spacing:2.6px;
    color:#ff2d55;font-weight:700;
    margin-bottom:6px;text-transform:uppercase;
    text-shadow:0 0 10px rgba(255,45,85,.6);
  }
  .consentBody{
    margin:0;color:#c9a3ad;
    font-family:'Times New Roman',Georgia,serif;
    font-size:13.5px;line-height:1.55;
  }
  .consentBody b{color:#ff5875;font-family:'Courier New',monospace;font-size:12.5px}
  .consentLinks{
    margin-top:8px;
    font-family:'Courier New',monospace;
    font-size:10.5px;letter-spacing:1.6px;
  }
  .consentLink{
    color:#7c5a63;text-decoration:none;
    text-transform:uppercase;
    transition:color .2s;
  }
  .consentLink:hover{color:#ff5875}
  .consentSep{color:#3a0a14;margin:0 8px}

  .consentBtn{
    flex:none;
    padding:12px 20px;
    background:linear-gradient(180deg,#3a0510,#1a0207);
    border:1px solid #7a0a1c;
    border-radius:7px;
    color:#ff5875;
    font-family:'Courier New',monospace;
    font-size:10.5px;letter-spacing:2.2px;
    font-weight:700;text-transform:uppercase;
    cursor:pointer;
    box-shadow:0 0 24px -6px rgba(225,29,72,.8);
    transition:all .2s;
  }
  .consentBtn:hover{
    background:linear-gradient(180deg,#5a0818,#2a030b);
    color:#fff;border-color:#ff2d55;
    box-shadow:0 0 32px -4px #ff2d55;
  }
  .consentBtn:active{transform:scale(.97)}

  @media (max-width:640px){
    .consentRoot{padding:12px 12px 16px}
    .consentCard{
      flex-direction:column;
      align-items:stretch;
      gap:14px;
      padding:14px 16px;
    }
    .consentBody{font-size:12.5px}
    .consentBtn{width:100%;text-align:center}
  }
`;
