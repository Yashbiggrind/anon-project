/* ============================================================
   ANON// — Shared utility functions
   ============================================================ */

export function serverUrl(): string {
  // Production: use the env var set on the deploy platform
  // (NEXT_PUBLIC_* vars are inlined at build time by Next.js)
  const fromEnv = process.env.NEXT_PUBLIC_SERVER_URL;
  if (fromEnv && fromEnv.length > 0) return fromEnv.replace(/\/$/, "");

  // SSR / build-time fallback
  if (typeof window === "undefined") return "http://localhost:4000";

  const host = window.location.hostname;

  // Localhost dev
  if (host === "localhost" || host === "127.0.0.1") {
    return "http://localhost:4000";
  }

  // LAN dev (phone on same Wi-Fi, etc.) — assume backend is on same machine, port 4000
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) {
    return `${window.location.protocol}//${host}:4000`;
  }

  // Any other host without NEXT_PUBLIC_SERVER_URL set — fail visibly in dev
  return "http://localhost:4000";
}

export function makeRandomName(): string {
  const A = ["Silent","Red","Dark","Crimson","Night","Shadow","Iron","Neon","Quiet","Hollow","Frozen","Lost"];
  const N = ["Wolf","Shadow","Fox","Ghost","Crow","Raven","Serpent","Cipher","Echo","Drift","Nomad","Wraith"];
  const a = A[Math.floor(Math.random() * A.length)];
  const n = N[Math.floor(Math.random() * N.length)];
  return `${a}${n}${Math.floor(100 + Math.random() * 900)}`;
}