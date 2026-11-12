"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clearAll, destroyStore } from "@/lib/messageStore";

type Snapshot = {
  exportedAt: string;
  origin: string;
  keys: { key: string; sizeBytes: number; preview: string }[];
  totalKeys: number;
  totalBytes: number;
};

const ANON_STORAGE_PREFIXES = ["anon_", "anon."] as const;

function isAnonStorageKey(key: string): boolean {
  return ANON_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function clearAnonStorage(storage: Storage): void {
  // Iterate backwards because removing an item shifts the remaining indexes.
  for (let i = storage.length - 1; i >= 0; i--) {
    const key = storage.key(i);
    if (key && isAnonStorageKey(key)) storage.removeItem(key);
  }
}

function scanLocalStorage(): Snapshot {
  const keys: Snapshot["keys"] = [];
  let total = 0;
  if (typeof window === "undefined") {
    return { exportedAt: new Date().toISOString(), origin: "", keys: [], totalKeys: 0, totalBytes: 0 };
  }
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !isAnonStorageKey(k)) continue;
    const v = localStorage.getItem(k) ?? "";
    const size = new Blob([k + v]).size;
    const sensitive = /(token|secret|password|credential|auth)/i.test(k);
    total += size;
    keys.push({
      key: k,
      sizeBytes: size,
      // Profile tokens are bearer credentials: never expose them in previews or exports.
      preview: sensitive ? "[REDACTED]" : (v.length > 80 ? v.slice(0, 80) + "…" : v),
    });
  }
  return {
    exportedAt: new Date().toISOString(),
    origin: location.origin,
    keys: keys.sort((a, b) => b.sizeBytes - a.sizeBytes),
    totalKeys: keys.length,
    totalBytes: total,
  };
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function toCsv(snap: Snapshot): string {
  const rows = [["key", "sizeBytes", "preview"]];
  for (const k of snap.keys) rows.push([k.key, String(k.sizeBytes), k.preview]);
  return rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
}

export default function DataPage() {
  const router = useRouter();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [toast, setToast] = useState("");
  const [confirm, setConfirm] = useState(false);

  function refresh() {
    setSnap(scanLocalStorage());
  }

  useEffect(() => {
    const timer = window.setTimeout(refresh, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  }

  function exportJson() {
    if (!snap) return;
    download(`anon-data-${Date.now()}.json`, JSON.stringify(snap, null, 2), "application/json");
    flash("JSON downloaded.");
  }

  function exportCsv() {
    if (!snap) return;
    download(`anon-data-${Date.now()}.csv`, toCsv(snap), "text/csv");
    flash("CSV downloaded.");
  }

  async function copyAll() {
    if (!snap) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(snap, null, 2));
      flash("Copied to clipboard.");
    } catch {
      flash("Clipboard blocked.");
    }
  }

  async function wipe() {
    if (typeof window === "undefined") return;
    const failures: string[] = [];

    // Clear only ANON-owned keys. Do not erase unrelated applications' data
    // that happen to share this browser origin.
    try { clearAnonStorage(localStorage); } catch { failures.push("ANON local storage"); }
    try { clearAnonStorage(sessionStorage); } catch { failures.push("ANON session storage"); }
    try {
      await clearAll();
      await destroyStore();
    } catch (error) {
      failures.push(error instanceof Error ? error.message : "IndexedDB");
    }

    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        const appCaches = keys.filter((key) => key.startsWith("anon-"));
        const results = await Promise.allSettled(appCaches.map((key) => caches.delete(key)));
        if (results.some((result) => result.status === "rejected" || (result.status === "fulfilled" && !result.value))) {
          failures.push("service-worker cache");
        }
      }
    } catch { failures.push("service-worker cache"); }

    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        const workerUrl = registration?.active?.scriptURL ||
          registration?.waiting?.scriptURL ||
          registration?.installing?.scriptURL ||
          "";
        // Only unregister ANON's own root service worker, never another app's worker.
        const workerPath = workerUrl ? new URL(workerUrl).pathname : "";
        if (registration && workerPath === "/sw.js" && new URL(workerUrl).origin === location.origin) {
          const removed = await registration.unregister();
          if (!removed) failures.push("ANON service worker registration");
        }
      }
    } catch { failures.push("service worker registration"); }

    refresh();
    setConfirm(false);
    flash(failures.length
      ? "Wipe completed with limits: " + failures.join(", ") + ". Close other ANON tabs and retry."
      : "ANON local data cleared. Close other ANON tabs to finish a full device wipe.");
    window.setTimeout(() => router.replace("/"), 1800);
  }

  const kb = snap ? (snap.totalBytes / 1024).toFixed(1) : "0";

  return (
    <>
      <style>{CSS}</style>
      <div className="dlRoot">
        <div className="dlHead">
          <div className="eyebrow">{"// DATA LOG"}</div>
          <h1>See what&apos;s on your device. Wipe it in one click.</h1>
          <p>This report lists ANON-prefixed localStorage keys only. Sensitive identity tokens are redacted. It does not include server-side connection metadata or active in-memory chat state.</p>
          <Link href="/" className="backBtn">← Back to chat</Link>
        </div>

        <div className="stats">
          <div className="stat">
            <span className="num">{snap?.totalKeys ?? 0}</span>
            <span className="lbl">KEYS</span>
          </div>
          <div className="stat">
            <span className="num">{kb}</span>
            <span className="lbl">KB</span>
          </div>
          <div className="stat">
            <span className="num">{snap?.origin.replace(/^https?:\/\//, "") ?? "—"}</span>
            <span className="lbl">ORIGIN</span>
          </div>
        </div>

        <div className="actions">
          <button className="btn" onClick={exportJson}>↓ EXPORT JSON</button>
          <button className="btn" onClick={exportCsv}>↓ EXPORT CSV</button>
          <button className="btn" onClick={copyAll}>⧉ COPY TO CLIPBOARD</button>
          <button className="btn refresh" onClick={refresh}>↻ REFRESH</button>
          <button className="btn danger" onClick={() => setConfirm(true)}>✕ WIPE EVERYTHING</button>
        </div>

        {toast && <div className="toast">{toast}</div>}

        <div className="table">
          <div className="tHead">
            <span>KEY</span>
            <span>SIZE</span>
            <span>PREVIEW</span>
          </div>
          {snap && snap.keys.length === 0 && (
            <div className="tEmpty">No local data found. Clean slate.</div>
          )}
          {snap?.keys.map((k) => (
            <div className="row" key={k.key}>
              <span className="k">{k.key}</span>
              <span className="s">{k.sizeBytes} B</span>
              <span className="p">{k.preview || "—"}</span>
            </div>
          ))}
        </div>

        {confirm && (
          <div className="modalBg" onClick={() => setConfirm(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>Wipe everything?</h3>
              <p>This clears ANON-owned localStorage and sessionStorage keys, saved chat messages in ANON IndexedDB, ANON cache entries, and ANON&apos;s service worker. Other applications&apos; browser storage is left untouched. Another open ANON tab may temporarily prevent database deletion. This does not erase server-side moderation reports or retained connection metadata. This cannot be undone.</p>
              <div className="modalRow">
                <button className="btn" onClick={() => setConfirm(false)}>CANCEL</button>
                <button className="btn danger" onClick={wipe}>YES, WIPE</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

const CSS = `
  .dlRoot{min-height:100vh;background:#040203;color:#e8dde2;padding:40px 20px 80px;font-family:'IBM Plex Mono','Courier New',monospace;}
  .dlHead{max-width:1000px;margin:0 auto 26px;padding-bottom:22px;border-bottom:1px solid #2a0a12;}
  .eyebrow{font-size:10px;letter-spacing:3px;color:#ff2d55;font-weight:700;text-transform:uppercase;margin-bottom:8px;}
  .dlHead h1{font-family:'Bodoni Moda','Times New Roman',serif;font-weight:900;font-size:clamp(26px,4.5vw,40px);letter-spacing:-.02em;margin:0 0 8px;color:#f4e8e8;text-wrap:balance;}
  .dlHead p{color:#8a7276;font-size:13px;margin:0 0 16px;}
  .backBtn{display:inline-flex;align-items:center;gap:6px;color:#ff5875;font-size:11px;letter-spacing:2px;text-transform:uppercase;text-decoration:none;padding:8px 14px;border:1px solid #4a0a14;border-radius:6px;background:#160409;transition:all .2s;}
  .backBtn:hover{background:#22060d;border-color:#e11d48;color:#fff;}

  .stats{max-width:1000px;margin:0 auto 16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;}
  .stat{background:linear-gradient(180deg,#0c0407,#060103);border:1px solid #25080f;border-radius:8px;padding:14px;display:flex;flex-direction:column;gap:4px;}
  .num{font-family:'Bodoni Moda',serif;font-weight:900;font-size:24px;color:#f4e8e8;letter-spacing:-.02em;word-break:break-all;}
  .lbl{font-size:9.5px;letter-spacing:2px;color:#5a4048;font-weight:700;}

  .actions{max-width:1000px;margin:0 auto 16px;display:flex;gap:8px;flex-wrap:wrap;}
  .btn{padding:9px 14px;background:#160409;border:1px solid #4a0a14;border-radius:6px;color:#ff5875;font-family:inherit;font-size:10.5px;letter-spacing:1.6px;font-weight:700;text-transform:uppercase;cursor:pointer;transition:all .2s;}
  .btn:hover{background:#22060d;border-color:#e11d48;color:#fff;}
  .btn.refresh{color:#8a7276;border-color:#2a0a12;}
  .btn.refresh:hover{color:#e8dde2;border-color:#4a0a14;}
  .btn.danger{color:#ff5875;border-color:#7a0a1c;}
  .btn.danger:hover{background:#3a0510;color:#fff;}

  .toast{max-width:1000px;margin:0 auto 12px;padding:10px 14px;background:rgba(53,210,124,.1);border:1px solid rgba(53,210,124,.5);border-radius:6px;color:#7dffa8;font-size:11.5px;letter-spacing:.5px;}

  .table{max-width:1000px;margin:0 auto;background:linear-gradient(180deg,#0c0407,#060103);border:1px solid #25080f;border-radius:10px;overflow:hidden;}
  .tHead{display:grid;grid-template-columns:1.4fr .6fr 2fr;gap:10px;padding:12px 16px;background:#0a0205;border-bottom:1px solid #2a0a12;font-size:9.5px;letter-spacing:2px;font-weight:700;color:#5a4048;}
  .row{display:grid;grid-template-columns:1.4fr .6fr 2fr;gap:10px;padding:11px 16px;border-bottom:1px solid #1a0610;font-size:11.5px;align-items:center;}
  .row:last-child{border-bottom:0;}
  .row:hover{background:#0a0205;}
  .k{color:#ffb8c6;word-break:break-all;}
  .s{color:#8a7276;}
  .p{color:#a89098;word-break:break-all;font-style:italic;}
  .tEmpty{padding:30px 16px;text-align:center;color:#5a4048;font-size:12px;font-style:italic;}

  .modalBg{position:fixed;inset:0;background:rgba(0,0,0,.75);backdrop-filter:blur(6px);display:grid;place-items:center;z-index:100;animation:fade .2s;}
  @keyframes fade{from{opacity:0;}to{opacity:1;}}
  .modal{max-width:420px;width:90%;background:linear-gradient(180deg,#0c0407,#060103);border:1px solid #7a0a1c;border-radius:12px;padding:26px;box-shadow:0 0 60px -10px #e11d48;}
  .modal h3{font-family:'Bodoni Moda',serif;font-weight:900;font-size:22px;margin:0 0 10px;color:#f4e8e8;letter-spacing:-.02em;}
  .modal p{color:#a89098;font-size:13px;line-height:1.6;margin:0 0 18px;}
  .modalRow{display:flex;gap:8px;justify-content:flex-end;}

  @media (max-width: 640px) {
    .dlRoot{min-height:100dvh;padding:22px 12px calc(56px + env(safe-area-inset-bottom));}
    .dlHead{margin-bottom:18px;padding-bottom:16px;}
    .eyebrow{font-size:9px;letter-spacing:2px;}
    .dlHead h1{font-size:clamp(27px,7vw,36px);line-height:1.1;}
    .dlHead p{font-size:12px;line-height:1.6;}
    .backBtn{min-height:40px;padding:9px 12px;font-size:10px;letter-spacing:1.3px;}
    .stats{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:12px;}
    .stat{min-width:0;padding:11px;border-radius:8px;}
    .num{font-size:clamp(18px,5vw,22px);overflow-wrap:anywhere;}
    .lbl{font-size:8px;letter-spacing:1.2px;line-height:1.4;overflow-wrap:anywhere;}
    .actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-bottom:12px;}
    .actions .btn{width:100%;min-width:0;min-height:42px;padding:9px 7px;font-size:9px;letter-spacing:.8px;white-space:normal;line-height:1.3;}
    .toast{padding:10px 11px;font-size:10.5px;line-height:1.55;overflow-wrap:anywhere;}
    .table{overflow-x:auto;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;}
    .tHead,.row{min-width:560px;grid-template-columns:minmax(130px,1.4fr) minmax(70px,.6fr) minmax(250px,2fr);gap:8px;padding:10px 12px;}
    .tHead{font-size:8.5px;letter-spacing:1.4px;}
    .row{font-size:10.5px;}
    .k,.p{overflow-wrap:anywhere;}
    .modalBg{padding:12px;align-items:center;overflow-y:auto;}
    .modal{width:100%;max-width:420px;max-height:calc(100dvh - 24px);overflow-y:auto;padding:19px;}
    .modal h3{font-size:20px;}
    .modal p{font-size:12px;line-height:1.65;}
    .modalRow{flex-direction:column-reverse;gap:8px;}
    .modalRow .btn{width:100%;min-height:42px;justify-content:center;}
  }
  @media (max-width: 360px) {
    .dlRoot{padding-left:9px;padding-right:9px;}
    .stats{gap:6px;}
    .stat{padding:9px;}
    .lbl{font-size:7.5px;}
    .actions .btn{font-size:8.3px;}
  }
`;