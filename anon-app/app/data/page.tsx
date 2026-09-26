"use client";

import { useEffect, useState } from "react";
import { Lang, translate, isRTL } from "@/lib/i18n";
import {
  tickFootprint,
  computeStats,
  FootprintStats,
  formatCountdown,
  resetFootprint,
} from "@/lib/footprint";
import { getStats as getMsgStats, clearAll as clearMsgs } from "@/lib/messageStore";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type ServerStats = {
  online: number; away: number; rooms: number;
  recent: number; recent_max: number; uptime_ms: number;
  databases: number; persistent_rows: number;
};

export default function DataPage() {
  const [lang, setLang] = useState<Lang>("en");
  const [ready, setReady] = useState(false);
  const [fp, setFp] = useState<FootprintStats | null>(null);
  const [server, setServer] = useState<ServerStats | null>(null);
  const [connected, setConnected] = useState(true);
  const [msgStats, setMsgStats] = useState<{ count: number; totalBytes: number }>({ count: 0, totalBytes: 0 });
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    const saved = (localStorage.getItem("anon_lang") as Lang) || "en";
    setLang(saved);
    const t = setTimeout(() => setReady(true), 60);

    const update = () => setFp(computeStats(tickFootprint()));
    update();
    const t1 = setInterval(update, 1000);

    const fetchServer = async () => {
      try {
        const r = await fetch(`${API}/api/stats`);
        if (!r.ok) throw new Error();
        setServer(await r.json());
        setConnected(true);
      } catch { setConnected(false); }
    };
    fetchServer();
    const t2 = setInterval(fetchServer, 5000);

    // v13 — refresh local message stats
    const fetchMsgStats = async () => {
      try {
        const s = await getMsgStats();
        setMsgStats(s);
      } catch { /* ignore */ }
    };
    fetchMsgStats();
    const t3 = setInterval(fetchMsgStats, 3000);

    return () => { clearTimeout(t); clearInterval(t1); clearInterval(t2); clearInterval(t3); };
  }, []);

  async function handleClearMessages() {
    if (!confirm("Erase ALL your local message history? This cannot be undone.")) return;
    setClearing(true);
    try {
      await clearMsgs();
      const s = await getMsgStats();
      setMsgStats(s);
      alert("Local history cleared.");
    } catch {
      alert("Could not clear history.");
    } finally {
      setClearing(false);
    }
  }

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dir = isRTL(lang) ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }, [lang]);

  if (!fp) return null;

  const TANK_W = 160;
  const TANK_H = 420;
  const PAD = 16;
  const innerH = TANK_H - PAD * 2;
  const liquidH = (fp.pctDeleted / 100) * innerH;
  const liquidY = TANK_H - PAD - liquidH;

  const cohorts = [...fp.cohorts];

  return (
    <>
      <style>{CSS}</style>
      <div className={`dataRoot ${ready ? "in" : ""}`}>
        <div className="scan" />

        <div className="dataCard">
          <a className="backBtn" href="/">← {translate(lang, "close")}</a>

          <h1 className="dataTitle" data-text="FOOTPRINT LOG">FOOTPRINT LOG</h1>
          <p className="dataSubtitle">
            Every day you are active, 100 new units of footprint arrive.
            Every hour, 3% of older units are permanently deleted.
            The oldest days fade to zero. The newest stays fresh.
          </p>

          <div className="dataDivider" />

          <div className="layout">
            <div className="tankCol">
              <svg viewBox={`0 0 ${TANK_W} ${TANK_H}`} className="tankSvg" aria-label={`${fp.pctDeleted.toFixed(1)}% deleted`}>
                <defs>
                  <linearGradient id="liquidG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#b8ffcf" stopOpacity="0.95" />
                    <stop offset="30%" stopColor="#7dffa8" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#0e6b3a" stopOpacity="1" />
                  </linearGradient>
                  <clipPath id="tankClip">
                    <rect x={PAD} y={PAD} width={TANK_W - PAD * 2} height={innerH} rx="16" />
                  </clipPath>
                </defs>

                <rect x={PAD} y={PAD} width={TANK_W - PAD * 2} height={innerH} rx="16" fill="#050102" stroke="#143a24" strokeWidth="2" />

                <g clipPath="url(#tankClip)">
                  <rect x={PAD} y={liquidY} width={TANK_W - PAD * 2} height={liquidH} fill="url(#liquidG)" />
                  <ellipse cx={TANK_W / 2} cy={liquidY} rx={(TANK_W - PAD * 2) / 2} ry="7" fill="#b8ffcf" opacity="0.85">
                    <animate attributeName="ry" values="4;8;4" dur="3s" repeatCount="indefinite" />
                  </ellipse>

                  {[0.3, 0.55, 0.72].map((x, i) => (
                    <circle key={i} cx={TANK_W * x} cy={TANK_H - PAD - 10} r={i === 1 ? 1.6 : 2.2} fill="#e0ffe9" opacity="0.65">
                      <animate attributeName="cy" from={TANK_H - PAD - 10} to={liquidY + 8} dur={`${5 + i}s`} repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0;0.7;0" dur={`${5 + i}s`} repeatCount="indefinite" />
                    </circle>
                  ))}

                  {cohorts.map((c, idx) => {
                    const yBase = TANK_H - PAD - ((idx + 1) / Math.max(1, cohorts.length)) * liquidH;
                    const bandH = liquidH / Math.max(1, cohorts.length);
                    const alivePct = c.created > 0 ? c.current / c.created : 0;
                    return (
                      <rect
                        key={c.dayIndex}
                        x={PAD}
                        y={yBase}
                        width={TANK_W - PAD * 2}
                        height={Math.max(0.5, bandH * 0.85)}
                        fill="#000"
                        opacity={0.25 - alivePct * 0.25}
                      />
                    );
                  })}
                </g>

                <rect x={PAD + 10} y={PAD + 10} width="7" height={innerH - 20} rx="3.5" fill="#ffffff" opacity="0.05" />
                <rect x={PAD} y={PAD} width={TANK_W - PAD * 2} height={innerH} rx="16" fill="none" stroke="#35d27c" strokeOpacity="0.4" strokeWidth="1" />
              </svg>

              <div className="tankLabel">
                <div className="tankPct">{fp.pctDeleted.toFixed(1)}%</div>
                <div className="tankPctLabel">CUMULATIVE DELETED</div>
                <div className="tankNext">
                  next hourly cut in <b>{formatCountdown(fp.nextDecayInMs)}</b>
                </div>
                <div className="tankNext small">
                  new day in <b>{formatCountdown(fp.nextDayInMs)}</b>
                </div>
              </div>
            </div>

            <div className="metricsCol">
              <Metric label="UNITS HELD NOW" value={fp.unitsHeld.toFixed(1)} hint="Everything alive in memory right now." />
              <Metric label="TOTAL EVER GENERATED" value={String(fp.unitsGenerated)} hint="Sum of every daily grant since you started." />
              <Metric label="TOTAL EVER DELETED" value={fp.unitsDeleted.toFixed(1)} hint="Cumulative units removed by hourly decay." accent />
              <Metric label="PERCENT DELETED" value={`${fp.pctDeleted.toFixed(2)}%`} accent />
              <Metric label="DAYS ALIVE" value={String(fp.daysAlive)} hint="Days since you first opened ANON// on this device." />
              <Metric label="OLDEST DAY REMAINING" value={fp.oldestAlive.toFixed(2)} hint="How much of your very first day is still alive." />
              <Metric label="NEWEST DAY REMAINING" value={fp.newestAlive.toFixed(2)} hint="Today's fresh footprint — untouched until tomorrow." />
            </div>
          </div>

          <div className="cohortsCard">
            <div className="cohortsTitle">DAY-BY-DAY BREAKDOWN</div>
            <div className="cohortsHead">
              <div>DAY</div><div>CREATED</div><div>ALIVE</div><div>DELETED</div><div>ALIVE %</div>
            </div>
            <div className="cohortsBody">
              {cohorts.slice().reverse().map((c) => {
                const alivePct = c.created > 0 ? (c.current / c.created) * 100 : 0;
                const label = c.dayIndex === fp.daysAlive ? "today" :
                              c.dayIndex === fp.daysAlive - 1 ? "yesterday" :
                              `day ${c.dayIndex + 1}`;
                return (
                  <div className="cohortRow" key={c.dayIndex}>
                    <div className="cLabel">{label}</div>
                    <div className="cCell">{c.created}</div>
                    <div className="cCell alive">{c.current.toFixed(1)}</div>
                    <div className="cCell del">{c.deleted.toFixed(1)}</div>
                    <div className="cBarWrap">
                      <div className="cBar" style={{ width: `${alivePct}%` }} />
                      <span className="cBarText">{alivePct.toFixed(0)}%</span>
                    </div>
                  </div>
                );
              })}
              {cohorts.length === 0 && <div className="muted">No cohorts yet.</div>}
            </div>
          </div>

          <div className="serverStrip">
            <div className="serverStripTitle">
              <span className={`dot ${connected ? "on" : "off"}`} />
              {connected ? "SERVER LIVE" : "SERVER UNREACHABLE"}
            </div>
            {server ? (
              <div className="serverGrid">
                <Stat label="ONLINE NOW" value={String(server.online)} />
                <Stat label="AWAY" value={String(server.away)} />
                <Stat label="OPEN ROOMS" value={String(server.rooms)} />
                <Stat label="RECENT MESSAGES" value={`${server.recent} / ${server.recent_max}`} />
                <Stat label="SERVER UPTIME" value={formatMs(server.uptime_ms)} />
                <Stat label="DATABASES" value={String(server.databases)} />
              </div>
            ) : (
              <div className="serverGrid">
                <Stat label="ONLINE NOW" value="—" />
                <Stat label="AWAY" value="—" />
                <Stat label="OPEN ROOMS" value="—" />
                <Stat label="RECENT MESSAGES" value="—" />
                <Stat label="SERVER UPTIME" value="—" />
                <Stat label="DATABASES" value="—" />
              </div>
            )}
          </div>

          <div className="storageCard">
            <div className="storageTitle">LOCAL MESSAGE HISTORY</div>
            <p className="storageSub">
              Your chat history is stored only on <b>this device</b> using IndexedDB.
              It is never sent to any server. Clear it any time.
            </p>
            <div className="storageGrid">
              <div className="storageStat">
                <div className="storageLabel">MESSAGES ON THIS DEVICE</div>
                <div className="storageValue">{msgStats.count}</div>
              </div>
              <div className="storageStat">
                <div className="storageLabel">LOCAL STORAGE USED</div>
                <div className="storageValue">{formatBytes(msgStats.totalBytes)}</div>
              </div>
              <div className="storageStat">
                <div className="storageLabel">ON ANON// SERVERS</div>
                <div className="storageValue zero">0 B</div>
              </div>
            </div>
            <button
              className="clearHistoryBtn"
              onClick={handleClearMessages}
              disabled={clearing || msgStats.count === 0}
            >
              {clearing ? "CLEARING…" : "🗑️ CLEAR LOCAL HISTORY"}
            </button>
          </div>

          <div className="rulesCard">
            <div className="rulesTitle">HOW THE DECAY WORKS</div>
            <ul className="rulesList">
              <li>Every active day adds <b>100 new units</b> to your footprint</li>
              <li>Every hour, <b>0.125%</b> of each old cohort is deleted (3% per day)</li>
              <li>Today's cohort is <b>safe for 24 hours</b> — then it starts decaying</li>
              <li>Older cohorts shrink faster than newer ones because 3% compounds on a smaller base</li>
              <li>Fully evaporated cohorts <b>disappear from the list</b> — that day is gone</li>
              <li>Nothing on this page lives on a server — <b>it all runs on your device</b></li>
            </ul>
          </div>

          <div className="actionsRow">
            <button className="resetBtn" onClick={() => {
              if (confirm("Reset your footprint and start fresh? This cannot be undone.")) {
                resetFootprint();
                window.location.reload();
              }
            }}>RESET MY FOOTPRINT</button>
          </div>

          <div className="dataFooter">
            This footprint lives only on your device. Nothing here is sent anywhere.
          </div>
        </div>
      </div>
    </>
  );
}

function Metric({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className={`metric ${accent ? "accent" : ""}`}>
      <div className="metricLabel">{label}</div>
      <div className="metricValue">{value}</div>
      {hint && <div className="metricHint">{hint}</div>}
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="statBox">
      <div className="statLabel">{label}</div>
      <div className="statValue">{value}</div>
    </div>
  );
}
function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}
function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

const CSS = `
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:#040203;color:#d8c9c9;font-family:'Times New Roman',Georgia,serif;overflow-x:hidden}
  .dataRoot{min-height:100vh;padding:80px 20px 60px;background:radial-gradient(ellipse at 50% 0%, rgba(53,210,124,.10) 0%, transparent 55%),radial-gradient(ellipse at 50% 100%, rgba(53,210,124,.06) 0%, transparent 55%),linear-gradient(180deg,#040203,#030a05);display:flex;justify-content:center;position:relative;opacity:0;transition:opacity .5s ease}
  .dataRoot.in{opacity:1}
  .scan{position:fixed;inset:0;pointer-events:none;z-index:1;background:repeating-linear-gradient(0deg,rgba(53,210,124,.03) 0px,rgba(53,210,124,.03) 1px,transparent 1px,transparent 3px);animation:scanMove 10s linear infinite}
  @keyframes scanMove{from{background-position:0 0}to{background-position:0 300px}}
  .dataCard{position:relative;z-index:2;width:min(1000px,100%);background:linear-gradient(180deg, rgba(8,15,10,.75), rgba(3,5,3,.9));border:1px solid #143a24;border-radius:12px;padding:40px 44px 52px;box-shadow:0 0 80px -20px rgba(53,210,124,.25), 0 0 0 1px rgba(53,210,124,.12) inset;animation:cardIn .8s cubic-bezier(.2,.8,.2,1) both}
  @keyframes cardIn{from{opacity:0;transform:translateY(30px) scale(.97);filter:blur(6px)}to{opacity:1;transform:none;filter:blur(0)}}
  .backBtn{display:inline-flex;align-items:center;gap:6px;color:#35d27c;font-family:'Courier New',monospace;font-size:12px;letter-spacing:2px;text-transform:uppercase;text-decoration:none;padding:8px 14px;border:1px solid #143a24;border-radius:6px;background:#05120a;margin-bottom:32px;transition:all .25s}
  .backBtn:hover{background:#0a1a10;border-color:#35d27c;color:#fff;box-shadow:0 0 30px -6px #35d27c}
  .dataTitle{font-family:'Times New Roman',Georgia,serif;font-size:clamp(28px, 4.2vw, 46px);font-weight:900;letter-spacing:2px;color:#35d27c;text-shadow:0 0 8px #35d27c, 0 0 24px rgba(53,210,124,.6), 0 0 60px rgba(53,210,124,.35);margin:0 0 12px;position:relative;animation:titleGlitch 1.2s cubic-bezier(.2,.8,.2,1) both;animation-delay:.15s}
  .dataTitle::before,.dataTitle::after{content:attr(data-text);position:absolute;top:0;left:0;width:100%;pointer-events:none}
  .dataTitle::before{color:#35d27c;opacity:.6;animation:glitchA 3s infinite steps(2);mix-blend-mode:screen}
  .dataTitle::after{color:#b8ffcf;opacity:.35;animation:glitchB 3.6s infinite steps(2);mix-blend-mode:screen}
  @keyframes titleGlitch{0%{opacity:0;transform:translateY(-12px);filter:blur(4px)}40%{opacity:1;transform:translateY(0);filter:blur(0)}100%{opacity:1;transform:none}}
  @keyframes glitchA{0%,100%{transform:translate(0,0);opacity:.6}10%{transform:translate(-2px,1px);opacity:.3}20%{transform:translate(2px,-1px);opacity:.7}30%{transform:translate(0,0);opacity:.6}60%{transform:translate(1px,2px);opacity:.25}70%{transform:translate(0,0);opacity:.6}}
  @keyframes glitchB{0%,100%{transform:translate(0,0);opacity:.35}15%{transform:translate(2px,-2px);opacity:.15}35%{transform:translate(-1px,1px);opacity:.5}55%{transform:translate(0,0);opacity:.35}80%{transform:translate(1px,-1px);opacity:.2}}
  .dataSubtitle{color:#7ca78c;font-family:'Courier New',monospace;font-size:13px;line-height:1.7;margin:0 0 22px;opacity:0;animation:fadeIn .6s ease forwards;animation-delay:.4s}
  @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
  .dataDivider{height:1px;background:linear-gradient(90deg, transparent, #35d27c, transparent);margin:0 0 32px;box-shadow:0 0 20px rgba(53,210,124,.5);animation:dividerIn 1s ease both;animation-delay:.5s}
  @keyframes dividerIn{from{transform:scaleX(0);opacity:0}to{transform:scaleX(1);opacity:1}}
  .layout{display:grid;grid-template-columns:260px 1fr;gap:36px;align-items:start}
  @media (max-width:760px){.layout{grid-template-columns:1fr;gap:24px}}
  .tankCol{display:flex;flex-direction:column;align-items:center;gap:14px;padding:22px 16px;border-radius:14px;background:linear-gradient(180deg, rgba(9,26,15,.6), rgba(3,7,4,.6));border:1px solid #143a24;box-shadow:0 0 40px -12px rgba(53,210,124,.35) inset}
  .tankSvg{width:100%;max-width:220px;height:auto;display:block}
  .tankLabel{text-align:center;font-family:'Courier New',monospace;width:100%}
  .tankPct{font-size:34px;font-weight:800;color:#7dffa8;text-shadow:0 0 14px #35d27c, 0 0 30px #35d27c88;letter-spacing:1px;line-height:1}
  .tankPctLabel{font-size:10px;letter-spacing:4px;color:#4b7d5e;margin-top:6px;text-transform:uppercase}
  .tankNext{font-size:11px;color:#5a8a6e;margin-top:12px;letter-spacing:.5px}
  .tankNext b{color:#b8ffcf;font-weight:700}
  .tankNext.small{font-size:10px;color:#3f6a52}
  .metricsCol{display:flex;flex-direction:column;gap:10px}
  .metric{padding:13px 16px;border-radius:10px;background:linear-gradient(180deg, rgba(10,20,14,.6), rgba(3,7,4,.5));border:1px solid #143a24;font-family:'Courier New',monospace;opacity:0;transform:translateY(8px);animation:sectionIn .5s ease forwards}
  .metric.accent{border-color:#1f5c36;background:linear-gradient(180deg, rgba(12,30,18,.75), rgba(3,10,5,.6));box-shadow:0 0 30px -12px rgba(53,210,124,.5) inset}
  .metric:nth-child(1){animation-delay:.6s}.metric:nth-child(2){animation-delay:.68s}.metric:nth-child(3){animation-delay:.76s}.metric:nth-child(4){animation-delay:.84s}.metric:nth-child(5){animation-delay:.92s}.metric:nth-child(6){animation-delay:1.0s}.metric:nth-child(7){animation-delay:1.08s}
  @keyframes sectionIn{to{opacity:1;transform:translateY(0)}}
  .metricLabel{font-size:10px;letter-spacing:2px;color:#4b7d5e;text-transform:uppercase;margin-bottom:5px}
  .metricValue{font-size:20px;color:#7dffa8;font-weight:700;letter-spacing:.5px;text-shadow:0 0 12px rgba(53,210,124,.5)}
  .metric.accent .metricValue{color:#b8ffcf;font-size:24px}
  .metricHint{font-size:10.5px;color:#5a8a6e;margin-top:5px;line-height:1.5;font-style:italic;font-family:'Times New Roman',serif}
  .cohortsCard{margin-top:32px;padding:20px 22px;border-radius:12px;background:linear-gradient(180deg, rgba(10,20,14,.6), rgba(3,7,4,.5));border:1px solid #143a24;opacity:0;animation:fadeIn .6s ease forwards;animation-delay:1.15s}
  .cohortsTitle{font-family:'Courier New',monospace;font-size:11px;letter-spacing:2.4px;color:#7dffa8;text-transform:uppercase;margin-bottom:14px}
  .cohortsHead{display:grid;grid-template-columns:1.2fr 1fr 1fr 1fr 1.6fr;gap:8px;font-family:'Courier New',monospace;font-size:9px;letter-spacing:1.6px;color:#4b7d5e;text-transform:uppercase;padding:6px 8px;border-bottom:1px solid #0f2e1c;margin-bottom:6px}
  .cohortsBody{display:flex;flex-direction:column;gap:5px;max-height:320px;overflow-y:auto}
  .cohortRow{display:grid;grid-template-columns:1.2fr 1fr 1fr 1fr 1.6fr;gap:8px;padding:8px;border-radius:6px;background:rgba(5,14,8,.4);border:1px solid #0f2e1c;font-family:'Courier New',monospace;font-size:11px;align-items:center}
  .cLabel{color:#b8ffcf;font-weight:700;text-transform:lowercase}
  .cCell{color:#7ca78c}
  .cCell.alive{color:#7dffa8;font-weight:700}
  .cCell.del{color:#ff5875}
  .cBarWrap{position:relative;height:14px;background:rgba(53,210,124,.08);border:1px solid #0f2e1c;border-radius:7px;overflow:hidden}
  .cBar{height:100%;background:linear-gradient(90deg,#0e6b3a,#35d27c,#b8ffcf);transition:width .6s ease;border-radius:7px}
  .cBarText{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:9px;color:#fff;text-shadow:0 0 4px #000;letter-spacing:1px}
  .muted{color:#4b7d5e;font-size:11px;font-style:italic;padding:8px}
  .serverStrip{margin-top:28px;padding:20px 22px;border-radius:12px;background:linear-gradient(180deg, rgba(10,20,14,.6), rgba(3,7,4,.5));border:1px solid #143a24;opacity:0;animation:fadeIn .6s ease forwards;animation-delay:1.25s}
  .serverStripTitle{display:flex;align-items:center;gap:8px;font-family:'Courier New',monospace;font-size:11px;letter-spacing:2.4px;color:#7dffa8;margin-bottom:14px;text-transform:uppercase}
  .dot{width:8px;height:8px;border-radius:50%}
  .dot.on{background:#35d27c;box-shadow:0 0 10px #35d27c;animation:pulse 1.8s ease-in-out infinite}
  .dot.off{background:#e11d48;box-shadow:0 0 10px #e11d48}
  @keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}
  .serverGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
  @media (max-width:720px){.serverGrid{grid-template-columns:repeat(2,1fr)}}
  .statBox{padding:10px 12px;border-radius:8px;background:rgba(5,14,8,.5);border:1px solid #0f2e1c;font-family:'Courier New',monospace}
  .statLabel{font-size:9px;letter-spacing:1.8px;color:#4b7d5e;text-transform:uppercase;margin-bottom:4px}
  .statValue{font-size:15px;color:#b8ffcf;font-weight:700}
  .rulesCard{margin-top:28px;padding:22px;border-radius:12px;background:linear-gradient(180deg, rgba(12,26,16,.5), rgba(3,8,4,.4));border:1px solid #143a24;border-left:3px solid #35d27c;opacity:0;animation:fadeIn .6s ease forwards;animation-delay:1.35s}
  .rulesTitle{font-family:'Courier New',monospace;font-size:11px;letter-spacing:2.4px;color:#7dffa8;text-transform:uppercase;margin-bottom:12px}
  .rulesList{list-style:none;padding:0;margin:0}
  .rulesList li{color:#c9dccb;font-family:'Courier New',monospace;font-size:12.5px;line-height:1.85;padding-left:20px;position:relative}
  .rulesList li::before{content:'▸';position:absolute;left:0;color:#35d27c}
  .rulesList b{color:#b8ffcf}
  .actionsRow{margin-top:28px;display:flex;justify-content:center;opacity:0;animation:fadeIn .6s ease forwards;animation-delay:1.45s}
  .resetBtn{background:transparent;border:1px solid #3a0a14;color:#ff5875;padding:11px 22px;border-radius:8px;font-family:'Courier New',monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;cursor:pointer;transition:all .25s}
  .resetBtn:hover{border-color:#e11d48;background:#2a0710;color:#fff}
  .dataFooter{margin-top:28px;padding-top:20px;border-top:1px solid #143a24;color:#4b7d5e;font-family:'Courier New',monospace;font-size:11px;line-height:1.7;font-style:italic;text-align:center;opacity:0;animation:fadeIn .6s ease forwards;animation-delay:1.55s}
  html[dir="rtl"] .dataSubtitle,html[dir="rtl"] .metricHint,html[dir="rtl"] .dataFooter{text-align:right}
  @media (max-width:600px){
    .dataRoot{padding:60px 12px 40px}
    .dataCard{padding:26px 18px 36px}
    .dataTitle{font-size:24px;letter-spacing:1px}
    .metricValue{font-size:17px}
    .metric.accent .metricValue{font-size:20px}
    .tankPct{font-size:26px}
    .cohortsHead,.cohortRow{grid-template-columns:1fr 1fr 1fr;gap:4px}
    .cohortsHead > div:nth-child(4),
    .cohortsHead > div:nth-child(5),
    .cohortRow > .cCell.del,
    .cohortRow > .cBarWrap{display:none}
  }

  /* ========== v13 — LOCAL MESSAGE HISTORY ========== */
  .storageCard{
    margin-top:28px;padding:22px;
    border-radius:12px;
    background:linear-gradient(180deg, rgba(10,20,14,.6), rgba(3,7,4,.5));
    border:1px solid #143a24;
    opacity:0;animation:fadeIn .6s ease forwards;animation-delay:1.3s;
  }
  .storageTitle{
    font-family:'Courier New',monospace;
    font-size:11px;letter-spacing:2.4px;
    color:#7dffa8;text-transform:uppercase;
    margin-bottom:10px;
  }
  .storageSub{
    color:#7ca78c;font-family:'Courier New',monospace;
    font-size:12px;line-height:1.7;margin:0 0 16px;
  }
  .storageSub b{color:#b8ffcf}
  .storageGrid{
    display:grid;grid-template-columns:repeat(3,1fr);
    gap:12px;margin-bottom:16px;
  }
  .storageStat{
    padding:14px;border-radius:8px;
    background:rgba(5,14,8,.5);
    border:1px solid #0f2e1c;
    font-family:'Courier New',monospace;
    text-align:center;
  }
  .storageLabel{
    font-size:9px;letter-spacing:1.6px;
    color:#4b7d5e;text-transform:uppercase;
    margin-bottom:6px;
  }
  .storageValue{
    font-size:22px;font-weight:800;
    color:#b8ffcf;
    text-shadow:0 0 12px rgba(53,210,124,.5);
    letter-spacing:.5px;
  }
  .storageValue.zero{color:#4b7d5e;text-shadow:none}
  .clearHistoryBtn{
    display:block;width:100%;
    padding:12px 20px;
    background:linear-gradient(180deg,#3a0510,#1a0207);
    border:1px solid #ff2d55;border-radius:8px;
    color:#ff5875;
    font-family:'Courier New',monospace;
    font-size:11px;letter-spacing:2.2px;font-weight:700;
    text-transform:uppercase;cursor:pointer;
    transition:all .25s;
  }
  .clearHistoryBtn:hover:not(:disabled){
    background:linear-gradient(180deg,#5a0818,#2a030b);
    color:#fff;
    box-shadow:0 0 30px -6px rgba(255,45,85,.9);
  }
  .clearHistoryBtn:disabled{
    opacity:.4;cursor:not-allowed;
  }

  @media (max-width:600px){
    .storageGrid{grid-template-columns:1fr;gap:8px}
    .storageValue{font-size:18px}
    .clearHistoryBtn{font-size:10px;letter-spacing:1.8px}
  }
`;