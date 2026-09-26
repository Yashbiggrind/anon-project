const KEY_START = "anon_session_start";
const KEY_SENT = "anon_messages_sent";
const KEY_SEEN = "anon_messages_seen";

export function ensureSessionStart(): number {
  if (typeof window === "undefined") return Date.now();
  const raw = localStorage.getItem(KEY_START);
  const n = raw ? parseInt(raw, 10) : 0;
  if (!Number.isFinite(n) || n <= 0) {
    const now = Date.now();
    localStorage.setItem(KEY_START, String(now));
    return now;
  }
  return n;
}
export function getSessionStart(): number {
  if (typeof window === "undefined") return Date.now();
  const raw = localStorage.getItem(KEY_START);
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n > 0 ? n : Date.now();
}
export function resetSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY_START);
  localStorage.removeItem(KEY_SENT);
  localStorage.removeItem(KEY_SEEN);
}
export function bumpSent(n = 1) {
  if (typeof window === "undefined") return;
  const raw = localStorage.getItem(KEY_SENT);
  const v = (raw ? parseInt(raw, 10) : 0) + n;
  localStorage.setItem(KEY_SENT, String(v));
}
export function bumpSeen(n = 1) {
  if (typeof window === "undefined") return;
  const raw = localStorage.getItem(KEY_SEEN);
  const v = (raw ? parseInt(raw, 10) : 0) + n;
  localStorage.setItem(KEY_SEEN, String(v));
}
export function getSent(): number {
  if (typeof window === "undefined") return 0;
  const raw = localStorage.getItem(KEY_SENT);
  const v = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(v) ? v : 0;
}
export function getSeen(): number {
  if (typeof window === "undefined") return 0;
  const raw = localStorage.getItem(KEY_SEEN);
  const v = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(v) ? v : 0;
}
export function estimateBytes(sent: number, seen: number): number {
  return (sent + seen) * 180;
}
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}
export function decayPercent(startMs: number): number {
  const elapsedSec = Math.max(0, (Date.now() - startMs) / 1000);
  const pct = (elapsedSec / 1800) * 100;
  return Math.min(99.9, pct);
}