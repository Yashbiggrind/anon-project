"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { LEGAL, LegalPage } from "@/lib/legal";
import { Lang, translate, isRTL } from "@/lib/i18n";

export default function LegalRoute() {
  const params = useParams();
  const [lang, setLang] = useState<Lang>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = (localStorage.getItem("anon_lang") as Lang) || "en";
    setLang(saved);
    const t = setTimeout(() => setReady(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dir = isRTL(lang) ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }, [lang]);

  const key = String(params?.page || "") as LegalPage;
  const data = LEGAL[key];

  if (!data) {
    return (
      <>
        <style>{CSS}</style>
        <div className={`legalRoot ${ready ? "in" : ""}`}>
          <div className="scan" />
          <div className="legalCard">
            <a className="legalBack" href="/">← Back</a>
            <div className="legalTitle" data-text="NOT FOUND">NOT FOUND</div>
            <div className="legalDivider" />
            <div className="legalBody">
              <p className="sectionItem">This page does not exist.</p>
            </div>
            {/* v22 — show the doc nav even on 404 so users can find the right page */}
            <nav className="legalDocNav" aria-label="Legal documents">
              {(Object.keys(LEGAL) as LegalPage[]).map((k) => (
                <a key={k} href={`/legal/${k}`} className="legalDocNavLink">
                  {LEGAL[k].title}
                </a>
              ))}
            </nav>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{CSS}</style>
      <div className={`legalRoot ${ready ? "in" : ""}`}>
        <div className="scan" />
        <div className="legalCard">
          <a className="legalBack" href="/">
            ← {translate(lang, "close")}
          </a>

          <h1 className="legalTitle" data-text={data.title.toUpperCase()}>
            {data.title}
          </h1>

          <p className="legalSubtitle">{data.subtitle}</p>

          {/* v22 — "Last updated" line (only if the doc provides one) */}
          {data.updated && (
            <div className="legalUpdated">
              <span className="legalUpdatedDot" />
              Last updated: {data.updated}
            </div>
          )}

          <div className="legalDivider" />

          <div className="sections">
            {data.sections.map((sec, si) => (
              <section
                className="section"
                key={si}
                style={{ animationDelay: `${150 + si * 90}ms` }}
              >
                <h2 className="sectionHead">
                  <span className="sectionNum">{String(si + 1).padStart(2, "0")}</span>
                  <span className="sectionTitle">{sec.heading}</span>
                </h2>
                <div className="sectionBody">
                  {sec.items.map((item, ii) => (
                    <p className="sectionItem" key={ii}>
                      {item}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {data.footer && <div className="legalFooter">{data.footer}</div>}

          {/* v22 — nav to other legal docs */}
          <nav className="legalDocNav" aria-label="Other legal documents">
            {(Object.keys(LEGAL) as LegalPage[])
              .filter((k) => k !== key)
              .map((k) => (
                <a key={k} href={`/legal/${k}`} className="legalDocNavLink">
                  {LEGAL[k].title}
                </a>
              ))}
          </nav>
        </div>
      </div>
    </>
  );
}

const CSS = `
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:#040203;color:#d8c9c9;font-family:'Times New Roman',Georgia,serif;overflow-x:hidden}

  .legalRoot{
    min-height:100vh;
    padding:80px 20px 60px;
    background:
      radial-gradient(ellipse at 50% 0%, rgba(225,29,72,.15) 0%, transparent 60%),
      radial-gradient(ellipse at 50% 100%, rgba(122,10,28,.12) 0%, transparent 60%),
      linear-gradient(180deg,#040203,#0a0204);
    display:flex;justify-content:center;position:relative;
    opacity:0;transition:opacity .5s ease;
  }
  .legalRoot.in{opacity:1}

  .scan{
    position:fixed;inset:0;pointer-events:none;z-index:1;
    background:repeating-linear-gradient(0deg,
      rgba(225,29,72,.03) 0px,
      rgba(225,29,72,.03) 1px,
      transparent 1px,
      transparent 3px);
    animation:scanMove 10s linear infinite;
  }
  @keyframes scanMove{from{background-position:0 0}to{background-position:0 300px}}

  .legalCard{
    position:relative;z-index:2;
    width:min(820px,100%);
    background:linear-gradient(180deg, rgba(15,3,8,.7), rgba(5,1,2,.85));
    border:1px solid #3a0a14;border-radius:12px;
    padding:40px 44px 52px;
    box-shadow:0 0 80px -20px rgba(225,29,72,.35), 0 0 0 1px rgba(225,29,72,.15) inset;
    animation:cardIn .8s cubic-bezier(.2,.8,.2,1) both;
  }
  @keyframes cardIn{
    from{opacity:0;transform:translateY(30px) scale(.97);filter:blur(6px)}
    to{opacity:1;transform:none;filter:blur(0)}
  }

  .legalBack{
    display:inline-flex;align-items:center;gap:6px;
    color:#ff5875;font-family:'Courier New',monospace;
    font-size:12px;letter-spacing:2px;text-transform:uppercase;
    text-decoration:none;padding:8px 14px;
    border:1px solid #4a0a14;border-radius:6px;background:#160409;
    margin-bottom:32px;transition:all .25s;
  }
  .legalBack:hover{background:#22060d;border-color:#e11d48;color:#fff;box-shadow:0 0 30px -6px #e11d48}

  .legalTitle{
    font-family:'Times New Roman',Georgia,serif;
    font-size:clamp(32px, 5vw, 56px);
    font-weight:900;letter-spacing:2px;color:#ff2d55;
    text-shadow:0 0 8px #ff2d55, 0 0 24px rgba(225,29,72,.6), 0 0 60px rgba(225,29,72,.35);
    margin:0 0 12px;position:relative;
    animation:titleGlitch 1.2s cubic-bezier(.2,.8,.2,1) both;
    animation-delay:.15s;
  }
  .legalTitle::before,
  .legalTitle::after{
    content:attr(data-text);position:absolute;top:0;left:0;width:100%;pointer-events:none;
  }
  .legalTitle::before{color:#ff2d55;opacity:0;animation:glitchA 2.4s ease-out .3s 1 forwards;mix-blend-mode:screen}
  .legalTitle::after{color:#e11d48;opacity:0;animation:glitchB 2.8s ease-out .3s 1 forwards;mix-blend-mode:screen}
  @keyframes titleGlitch{
    0%{opacity:0;transform:translateY(-12px);filter:blur(4px)}
    40%{opacity:1;transform:translateY(0);filter:blur(0)}
    42%{transform:translate(2px,0)}44%{transform:translate(-2px,0)}46%{transform:translate(0,0)}
    100%{opacity:1;transform:none}
  }
  @keyframes glitchA{
    0%{transform:translate(0,0);opacity:0}
    15%{transform:translate(-2px,1px);opacity:.55}
    35%{transform:translate(2px,-1px);opacity:.35}
    55%{transform:translate(-1px,0);opacity:.45}
    80%{transform:translate(1px,0);opacity:.2}
    100%{transform:translate(0,0);opacity:0}
  }
  @keyframes glitchB{
    0%{transform:translate(0,0);opacity:0}
    20%{transform:translate(2px,-2px);opacity:.4}
    45%{transform:translate(-1px,1px);opacity:.5}
    70%{transform:translate(1px,-1px);opacity:.25}
    100%{transform:translate(0,0);opacity:0}
  }

  .legalSubtitle{
    color:#a8899a;font-family:'Courier New',monospace;
    font-size:13.5px;line-height:1.7;margin:0 0 22px;
    opacity:0;animation:lineIn .6s ease forwards;animation-delay:.4s;
  }
  @keyframes lineIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}

  .legalDivider{
    height:1px;background:linear-gradient(90deg, transparent, #e11d48, transparent);
    margin:0 0 32px;box-shadow:0 0 20px rgba(225,29,72,.5);
    animation:dividerIn 1s ease both;animation-delay:.5s;
  }
  @keyframes dividerIn{from{transform:scaleX(0);opacity:0}to{transform:scaleX(1);opacity:1}}

  .legalBody{display:flex;flex-direction:column;gap:6px}

  .sections{display:flex;flex-direction:column;gap:22px}

  .section{
    padding:22px 24px;
    background:linear-gradient(180deg, rgba(22,4,9,.55), rgba(10,2,4,.4));
    border:1px solid #2a0a12;
    border-left:3px solid #e11d48;
    border-radius:10px;
    opacity:0;transform:translateY(12px);
    animation:sectionIn .6s cubic-bezier(.2,.8,.2,1) forwards;
  }
  @keyframes sectionIn{to{opacity:1;transform:translateY(0)}}

  .sectionHead{
    display:flex;align-items:baseline;gap:14px;
    margin:0 0 14px;padding:0;
    font-family:'Times New Roman',serif;
    font-weight:900;font-size:19px;
    color:#ff5875;
    text-shadow:0 0 12px rgba(225,29,72,.55);
    letter-spacing:.5px;
  }
  .sectionNum{
    font-family:'Courier New',monospace;
    font-size:12px;letter-spacing:2px;
    color:#7c5a63;font-weight:700;
    flex:none;
  }
  .sectionTitle{flex:1;line-height:1.3}

  .sectionBody{display:flex;flex-direction:column;gap:6px}
  .sectionItem{
    margin:0;
    color:#c9a3ad;
    font-family:'Courier New',monospace;
    font-size:13px;line-height:1.75;
    word-break:break-word;
  }
  .sectionItem::before{
    content:'—';color:#7a0a1c;margin-right:8px;
    display:inline-block;
  }

  .legalFooter{
    margin-top:30px;padding-top:22px;
    border-top:1px solid #2a0a12;
    color:#7c5a63;font-family:'Courier New',monospace;
    font-size:12px;line-height:1.7;font-style:italic;
    opacity:0;animation:lineIn .6s ease forwards;
    animation-delay:1.2s;
  }

  /* v22 — last updated line */
  .legalUpdated{
    display:inline-flex;align-items:center;gap:8px;
    font-family:'Courier New',monospace;
    font-size:10.5px;letter-spacing:1.8px;
    color:#7c5a63;text-transform:uppercase;
    margin:-8px 0 0;
    opacity:0;animation:lineIn .6s ease forwards;
    animation-delay:.45s;
  }
  .legalUpdatedDot{
    width:6px;height:6px;border-radius:50%;
    background:#35d27c;
    box-shadow:0 0 10px rgba(53,210,124,.8);
    animation:legalPulse 2s ease-in-out infinite;
  }
  @keyframes legalPulse{0%,100%{opacity:.6}50%{opacity:1}}

  /* v22 — cross-doc navigation footer */
  .legalDocNav{
    display:flex;flex-wrap:wrap;gap:8px;
    margin-top:36px;padding-top:24px;
    border-top:1px solid #2a0a12;
    opacity:0;animation:lineIn .6s ease forwards;
    animation-delay:1.4s;
  }
  .legalDocNavLink{
    font-family:'Courier New',monospace;
    font-size:10.5px;letter-spacing:1.6px;
    text-transform:uppercase;
    color:#7c5a63;text-decoration:none;
    padding:6px 12px;border-radius:6px;
    border:1px solid #2a0a12;background:rgba(22,4,9,.5);
    transition:all .18s;
  }
  .legalDocNavLink:hover{
    color:#ff5875;border-color:#7a0a1c;
    background:#160409;
  }

  html[dir="rtl"] .legalSubtitle,
  html[dir="rtl"] .sectionItem,
  html[dir="rtl"] .legalFooter,
  html[dir="rtl"] .sectionHead,
  html[dir="rtl"] .legalUpdated{
    direction:ltr;text-align:left;
  }

  @media (max-width:640px){
    .legalRoot{padding:60px 12px 40px}
    .legalCard{padding:26px 20px 36px}
    .legalTitle{font-size:28px;letter-spacing:1px}
    .legalSubtitle{font-size:12.5px}
    .section{padding:16px 16px;border-radius:8px}
    .sectionHead{font-size:16px;gap:10px;margin-bottom:10px}
    .sectionNum{font-size:10px}
    .sectionItem{font-size:12px}
    .sections{gap:16px}
  }
`;