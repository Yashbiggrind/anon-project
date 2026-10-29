"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clearAll, destroyStore, exportAllMessages } from "@/lib/messageStore";
import { list as listOfflineQueue } from "@/lib/offlineQueue";

type Snapshot = {
  exportedAt: string;
  origin: string;
  keys: { key: string; sizeBytes: number; preview: string }[];
  totalKeys: number;
  totalBytes: number;
  storageReadError?: boolean;
};

function scanLocalStorage(): Snapshot {
  const keys: Snapshot["keys"] = [];
  let total = 0;
  let storageReadError = false;
  if (typeof window === "undefined") {
    return { exportedAt: new Date().toISOString(), origin: "", keys: [], totalKeys: 0, totalBytes: 0 };
  }
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const v = localStorage.getItem(k) ?? "";
      const size = new Blob([k + v]).size;
      total += size;
      keys.push({
        key: k,
        sizeBytes: size,
        preview: v.length > 80 ? v.slice(0, 80) + "…" : v,
      });
    }
  } catch {
    storageReadError = true;
  }
  return {
    exportedAt: new Date().toISOString(),
    origin: location.origin,
    keys: keys.sort((a, b) => b.sizeBytes - a.sizeBytes),
    totalKeys: keys.length,
    totalBytes: total,
    storageReadError,
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
  const [revealPreviews, setRevealPreviews] = useState(false);

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

  async function exportJson() {
    if (!snap || typeof window === "undefined") return;
    const localStorageEntries: Array<{ key: string; value: string | null }> = [];
    let localStorageComplete = true;

    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key) localStorageEntries.push({ key, value: window.localStorage.getItem(key) });
      }
    } catch {
      localStorageComplete = false;
    }

    const [messageHistory, offlineQueue] = await Promise.all([
      exportAllMessages(),
      Promise.resolve(listOfflineQueue()),
    ]);
    const bundle = {
      format: "ANON_LOCAL_DATA_EXPORT",
      version: 1,
      exportedAt: new Date().toISOString(),
      origin: window.location.origin,
      scope: "This browser profile only. This is not a server-side account export.",
      completeness: {
        localStorage: localStorageComplete ? "read" : "partial",
        indexedDbHistory: "retained records after local expiry cleanup",
        offlineQueue: "current queued messages",
        serverRecords: "not included",
        browserAndProviderLogs: "not included",
        otherDevicesAndRecipientCopies: "not included",
      },
      localStorage: localStorageEntries,
      messageHistory,
      offlineQueue,
    };
    download(`anon-local-data-${Date.now()}.json`, JSON.stringify(bundle, null, 2), "application/json");
    flash(localStorageComplete
      ? `Local data bundle downloaded: ${messageHistory.length} retained messages and ${offlineQueue.length} queued messages. Keep this file private.`
      : "A partial local data bundle was downloaded because some browser storage could not be read.");
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

    // Clear first so even if deletion of the database is blocked by another tab,
    // stored message contents are removed from the current database.
    try { localStorage.clear(); } catch { failures.push("local storage"); }
    try { sessionStorage.clear(); } catch { failures.push("session storage"); }
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
        if (registration) {
          const removed = await registration.unregister();
          if (!removed) failures.push("service worker registration");
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
          <div className="eyebrow">{"// LOCAL DATA CONTROLS"}</div>
          <h1>See what this browser keeps. Clear it when you choose.</h1>
          <p>Inspect what this browser stores, export a local data bundle, or clear local data. The bundle can include message text, local settings and queued messages, so keep it private. This page cannot access server records, hosting logs, old backups, other devices or recipient copies.</p>
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
          <button className="btn pri" onClick={exportJson}>↓ EXPORT LOCAL DATA BUNDLE</button>
          <button className="btn" onClick={exportCsv}>↓ EXPORT STORAGE REPORT CSV</button>
          <button className="btn" onClick={copyAll}>⧉ COPY TO CLIPBOARD</button>
          <button className="btn refresh" onClick={refresh}>↻ REFRESH</button>
          <button className="btn" onClick={() => setRevealPreviews((show) => !show)} aria-pressed={revealPreviews}>{revealPreviews ? "HIDE PREVIEWS" : "REVEAL PREVIEWS"}</button>
          <button className="btn danger" onClick={() => setConfirm(true)}>✕ CLEAR LOCAL DATA</button>
        </div>

        {toast && <div className="toast">{toast}</div>}

        <div className="table">
          <div className="tHead">
            <span>KEY</span>
            <span>SIZE</span>
            <span>PREVIEW</span>
          </div>
          {snap?.storageReadError && (
            <div className="storageNotice" role="status">Browser storage could not be read completely. Review browser permissions or try again in a normal browsing window.</div>
          )}
          {snap && snap.keys.length === 0 && !snap.storageReadError && (
            <div className="tEmpty">No localStorage entries were found in this browser profile. Server-side records may still exist.</div>
          )}
          {snap?.keys.map((k) => (
            <div className="row" key={k.key}>
              <span className="k">{k.key}</span>
              <span className="s">{k.sizeBytes} B</span>
              <span className="p">{revealPreviews ? (k.preview || "—") : (k.preview ? "Hidden — reveal to inspect" : "—")}</span>
            </div>
          ))}
        </div>

        {confirm && (
          <div className="modalBg" onClick={() => setConfirm(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>Clear local data?</h3>
              <p>This clears ANON localStorage, sessionStorage, saved chat messages in IndexedDB, app cache entries, and the service-worker registration in this browser. It does not remove server-side anti-abuse records, external backups, screenshots, or recipients’ copies. Another open ANON tab may temporarily prevent database deletion. This cannot be undone.</p>
              <div className="modalRow">
                <button className="btn" onClick={() => setConfirm(false)}>CANCEL</button>
                <button className="btn danger" onClick={wipe}>YES, CLEAR LOCAL DATA</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

const CSS = `
  .dlRoot{min-height:100vh;background:#040203;color:#e8dde2;padding:40px 20px 80px;font-family:Inter,ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;}
  .dlHead{max-width:1000px;margin:0 auto 26px;padding-bottom:22px;border-bottom:1px solid #2a0a12;}
  .eyebrow{font-size:10px;letter-spacing:3px;color:#ff2d55;font-weight:700;text-transform:uppercase;margin-bottom:8px;}
  .dlHead h1{font-family:'Bodoni Moda','Times New Roman',serif;font-weight:900;font-size:clamp(26px,4.5vw,40px);letter-spacing:-.02em;margin:0 0 8px;color:#f4e8e8;text-wrap:balance;}
  .dlHead p{color:#8a7276;font-size:13px;margin:0 0 16px;}
  .storageNotice{max-width:1000px;margin:0 auto 12px;padding:12px 14px;border:1px solid #57404a;border-radius:9px;background:#100b0f;color:#d6c6cd;font:12px/1.6 Inter,system-ui,sans-serif}
  .dlRoot :focus-visible{outline:2px solid #ff8199;outline-offset:3px}

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
`;