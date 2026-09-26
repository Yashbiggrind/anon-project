/* ============================================================
   ANON// — Shared utility functions
   ============================================================ */

export function serverUrl(): string {
  if (typeof window === "undefined") return "http://localhost:4000";
  return `${window.location.protocol}//${window.location.hostname}:4000`;
}

export function makeRandomName(): string {
  const A = ["Silent","Red","Dark","Crimson","Night","Shadow","Iron","Neon","Quiet","Hollow","Frozen","Lost"];
  const N = ["Wolf","Shadow","Fox","Ghost","Crow","Raven","Serpent","Cipher","Echo","Drift","Nomad","Wraith"];
  const a = A[Math.floor(Math.random() * A.length)];
  const n = N[Math.floor(Math.random() * N.length)];
  return `${a}${n}${Math.floor(100 + Math.random() * 900)}`;
}