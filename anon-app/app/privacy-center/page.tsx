"use client";

import Link from "next/link";

const CSS = `
  .pc-root{min-height:100vh;background:#050305;color:#f4edf0;padding:28px 18px 64px;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  .pc-wrap{max-width:1060px;margin:0 auto}
  .pc-top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:22px}
  .pc-brand{color:#ff5577;font:750 11px ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.18em;text-transform:uppercase}
  .pc-link{display:inline-flex;align-items:center;justify-content:center;gap:8px;color:#f7e7ec;text-decoration:none;border:1px solid #492330;background:#140a0f;border-radius:999px;padding:11px 15px;font-size:12px;font-weight:650;transition:transform .18s,border-color .18s,background .18s}
  .pc-link:hover{border-color:#ff5577;background:#1c0b12;transform:translateY(-1px)}
  .pc-hero{position:relative;overflow:hidden;padding:clamp(24px,5vw,52px);border:1px solid #47212e;border-radius:25px;background:radial-gradient(ellipse at 90% 0%,rgba(225,29,72,.2),transparent 42%),linear-gradient(135deg,#160b11,#090609 72%);box-shadow:0 25px 90px rgba(0,0,0,.24)}
  .pc-kicker{font:750 10px ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.2em;text-transform:uppercase;color:#ff7692}
  .pc-hero h1{font-size:clamp(38px,6.6vw,70px);line-height:.99;letter-spacing:-.065em;margin:16px 0 18px;max-width:800px}
  .pc-hero p{max-width:720px;color:#d0bdc5;line-height:1.8;margin:0;font-size:15px}
  .pc-pills{display:flex;flex-wrap:wrap;gap:8px;margin-top:22px}
  .pc-pill{border:1px solid #4a2a35;background:#120a0e;border-radius:999px;padding:8px 11px;color:#e5cdd5;font-size:11px}
  .pc-cta{display:flex;flex-wrap:wrap;gap:10px;margin-top:28px}
  .pc-primary{background:linear-gradient(135deg,#ed3157,#9e1637);border-color:#ff5577;color:white}
  .pc-section{margin-top:32px}
  .pc-section-head{display:flex;align-items:end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}
  .pc-section h2{font-size:clamp(20px,3vw,25px);letter-spacing:-.035em;margin:0}
  .pc-section-head p{font-size:12px;color:#a9949d;margin:0}
  .pc-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
  .pc-card{border:1px solid #302129;border-radius:17px;padding:21px;background:linear-gradient(145deg,#100b0e,#090709);min-width:0}
  .pc-icon{width:36px;height:36px;display:grid;place-items:center;border:1px solid #5b293a;background:#1d0b12;border-radius:11px;color:#ff7d99;font-size:17px}
  .pc-card h3{margin:14px 0 8px;font-size:16px;letter-spacing:-.02em}
  .pc-card p{margin:0;color:#beadb5;font-size:13px;line-height:1.75}
  .pc-note{border:1px solid #49303a;border-radius:16px;background:#100a0e;padding:19px 20px;color:#cbb8c0;font-size:13px;line-height:1.8}
  .pc-note strong{color:#f4dce4}
  .pc-details{margin-top:12px;border:1px solid #33212a;border-radius:14px;background:#0b080a;overflow:hidden}
  .pc-details summary{cursor:pointer;padding:16px 18px;color:#f1dce3;font-size:13px;font-weight:700;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px}
  .pc-details summary::-webkit-details-marker{display:none}
  .pc-details summary:after{content:"+";font-size:19px;color:#ff6c8a;font-weight:500}
  .pc-details[open] summary:after{content:"−"}
  .pc-details-body{padding:0 18px 18px;color:#bdaab3;font-size:12px;line-height:1.8}
  .pc-details-body p{margin:0 0 12px}
  .pc-details-body p:last-child{margin-bottom:0}
  .pc-details-body strong{color:#f0dce3}
  .pc-detail-row{display:grid;grid-template-columns:190px 1fr;gap:16px;padding:12px 0;border-top:1px solid #2b1c23}
  .pc-detail-row strong{font-size:12px}
  .pc-foot{margin-top:30px;border-top:1px solid #35212a;padding-top:18px;color:#98858e;font-size:11px;line-height:1.8}
  @media(max-width:680px){.pc-grid{grid-template-columns:1fr}.pc-root{padding-inline:12px}.pc-hero{border-radius:18px}.pc-card{padding:17px}.pc-detail-row{grid-template-columns:1fr;gap:4px}.pc-hero p{font-size:14px}}
`;

export default function PrivacyCenterPage() {
  return (
    <>
      <style>{CSS}</style>
      <main className="pc-root">
        <div className="pc-wrap">
          <nav className="pc-top" aria-label="Privacy navigation">
            <div className="pc-brand">ANON // YOUR PRIVACY</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <Link className="pc-link" href="/trust">How it works</Link>
              <Link className="pc-link" href="/">Back to ANON ↗</Link>
            </div>
          </nav>

          <section className="pc-hero">
            <div className="pc-kicker">Your space. Your identity.</div>
            <h1>Say what you mean.<br/>Not who you are.</h1>
            <p>ANON is built for pseudonymous conversations. You can join without putting your real name, phone number or email into a public profile. Keep the focus on what you want to say—not on who you are offline.</p>
            <div className="pc-pills">
              <span className="pc-pill">No conventional sign-up</span>
              <span className="pc-pill">Pseudonymous presence</span>
              <span className="pc-pill">Choose your conversation</span>
            </div>
            <div className="pc-cta">
              <Link className="pc-link pc-primary" href="/#explore">Find your space ↗</Link>
              <Link className="pc-link" href="/data">Privacy & data controls</Link>
            </div>
          </section>

          <section className="pc-section">
            <div className="pc-section-head">
              <h2>Privacy, without the complicated bits</h2>
              <p>Made to be simple from the first tap</p>
            </div>
            <div className="pc-grid">
              <article className="pc-card">
                <div className="pc-icon" aria-hidden="true">◉</div>
                <h3>Your real identity stays out of your profile</h3>
                <p>ANON does not require a conventional account sign-up to start chatting. Use a pseudonymous presence instead of introducing yourself with real-world details.</p>
              </article>
              <article className="pc-card">
                <div className="pc-icon" aria-hidden="true">⌘</div>
                <h3>Choose where you speak</h3>
                <p>Public spaces are public. Private rooms are intended for their members. Before sharing something personal, take a moment to check which space you are in.</p>
              </article>
              <article className="pc-card">
                <div className="pc-icon" aria-hidden="true">↻</div>
                <h3>Less personal information is better</h3>
                <p>You can take part without sharing your real name, phone number, home address, passwords or other identifying details with other people in the conversation.</p>
              </article>
              <article className="pc-card">
                <div className="pc-icon" aria-hidden="true">⌕</div>
                <h3>Find the controls when you need them</h3>
                <p>Open the data controls to review the tools currently available, or visit the Trust Layer for a closer look at the features and demos.</p>
                <div style={{marginTop:14,display:"flex",gap:8,flexWrap:"wrap"}}>
                  <Link className="pc-link" href="/data">Open data controls →</Link>
                  <Link className="pc-link" href="/trust">Explore Trust Layer →</Link>
                </div>
              </article>
              <article className="pc-card">
                <div className="pc-icon" aria-hidden="true">⌁</div>
                <h3>Local Privacy Guard</h3>
                <p>A browser-only check can flag common patterns such as email addresses, phone numbers, some ID formats and credential-like text in chat messages, edits, image captions, confession posts and replies. It offers editable redactions; it does not inspect image pixels and cannot detect every sensitive detail.</p>
                <p style={{marginTop:10,color:"#8ddbb6",fontSize:11}}>Runs on this device · Toggle from the chat toolbar</p>
              </article>
              <article className="pc-card">
                <div className="pc-icon" aria-hidden="true">◐</div>
                <h3>Quick Veil</h3>
                <p>Cover the chat screen and mute app sound in one tap, or use Alt + Shift + V. This is a shoulder-surfing aid—not a disconnect button; messages may still arrive in the background.</p>
                <p style={{marginTop:10,color:"#8ddbb6",fontSize:11}}>No message content is uploaded by this control</p>
              </article>
              <article className="pc-card">
                <div className="pc-icon" aria-hidden="true">⌛</div>
                <h3>Ephemeral History</h3>
                <p>Turn it on to clear saved chat history and unsent offline messages from this browser, then stop saving new message history locally. It is not a server-side deletion request: anti-abuse records and other people&apos;s copies are separate.</p>
                <p style={{marginTop:10,color:"#8ddbb6",fontSize:11}}>Choose ON/OFF from the chat toolbar</p>
              </article>
              <article className="pc-card">
                <div className="pc-icon" aria-hidden="true">✳</div>
                <h3>AI bots are labelled. External sharing is off by default</h3>
                <p>Bot names carry an AI label rather than pretending to be human. External model generation is off by default. If the operator enables it, provider requests are limited to fixed, bot-initiated opener prompts; user-written messages and custom room topics are not forwarded by the bot path.</p>
                <p style={{marginTop:10,color:"#8ddbb6",fontSize:11}}>Provider processing may still apply to static opener prompts when enabled</p>
              </article>
              <article className="pc-card">
                <div className="pc-icon" aria-hidden="true">⌁</div>
                <h3>Room-only names</h3>
                <p>Private rooms now use a separate alias and opaque member token for each participant within that room. A different room gets a different alias, and the member list explains that names are room-scoped.</p>
                <p style={{marginTop:10,color:"#8ddbb6",fontSize:11}}>Reduces direct ID reuse across rooms · Not end-to-end encryption</p>
              </article>
            </div>
          </section>

          <section className="pc-section">
            <div className="pc-section-head">
              <h2>Small habits that help protect your privacy</h2>
              <p>Simple things you control</p>
            </div>
            <div className="pc-note">
              <strong>Your alias is meant to keep the focus on what you say—not on your offline identity.</strong> For a more private experience, check which space you are in before posting and keep passwords, payment details and other identifying information out of messages. Open the details below for a plain-language explanation of how information is handled.
            </div>

            <details className="pc-details">
              <summary>What information is handled behind the scenes?</summary>
              <div className="pc-details-body">
                <div className="pc-detail-row">
                  <strong>Account and identity</strong>
                  <span>The inspected code does not use a conventional username/password account flow for joining chat. Display names are pseudonymous; do not treat them as proof that a network connection cannot be linked.</span>
                </div>
                <div className="pc-detail-row">
                  <strong>Connection records</strong>
                  <span>In this draft branch, persistent session logging is off by default. Unless the operator explicitly sets ANON_SESSION_LOGS=on, new connection/session rows are not written and existing session rows in the active database are cleared at startup. When logging is intentionally enabled, the 180-day cleanup setting applies. This cannot erase older backups or independent hosting-provider records.</span>
                </div>
                <div className="pc-detail-row">
                  <strong>Safety and abuse handling</strong>
                  <span>Safety records have a bounded policy in this branch: reviewed reports older than 90 days are purged; inactive anti-spam strikes older than 30 days are purged only after cooldown and shadow-ban periods have expired. Unreviewed reports remain for moderation. These rules apply to the active application database, not older backups or hosting-provider logs.</span>
                </div>
                <div className="pc-detail-row">
                  <strong>Private messages</strong>
                  <span>The current inspected server routes handle readable message content. End-to-end encryption for live chats is not established yet. The separate browser demonstration on the Trust Layer encrypts sample text only; it does not protect live conversations.</span>
                </div>
                <p style={{marginTop:14}}>This summary describes a review of the repository code, not an independent audit or proof of every production setting. Some details may differ in a deployed environment.</p>
              </div>
            </details>

            <details className="pc-details">
              <summary>What does “pseudonymous” mean?</summary>
              <div className="pc-details-body">
                <p>It means you can use a name that is not your real-world name. It is a way to avoid putting your offline identity on display—not a guarantee that every network, device, recipient or service record is invisible.</p>
                <p>For a more private experience, avoid reusing personal usernames and do not include identifying details in messages or profile text.</p>
              </div>
            </details>
          </section>

          <footer className="pc-foot">
            Privacy should feel clear—not confusing. We want ANON&apos;s privacy promises to match the way the product works, and we will keep improving the controls and protections as they are implemented and tested.
            <br/><br/>
            <Link href="/" className="pc-link">← Back to ANON</Link>
          </footer>
        </div>
      </main>
    </>
  );
}
