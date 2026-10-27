/* ============================================================
   ANON// — Shared utility functions
   ============================================================ */

// Public endpoint for the currently verified production backend.
// This is not a secret. NEXT_PUBLIC_SERVER_URL can override it when configured.
const DEFAULT_PRODUCTION_SERVER_URL =
  "https://balanced-creativity-production-515b.up.railway.app";

function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".railway.internal")
  );
}

export function serverUrl(): string {
  // NEXT_PUBLIC_* values are inlined into the frontend at build time.
  const isProduction = process.env.NODE_ENV === "production";
  const fromEnv = process.env.NEXT_PUBLIC_SERVER_URL;

  if (fromEnv && fromEnv.trim().length > 0) {
    const configured = fromEnv.trim().replace(/\/$/, "");
    let parsed: URL;

    try {
      parsed = new URL(configured);
    } catch {
      if (isProduction) return DEFAULT_PRODUCTION_SERVER_URL;
      throw new Error("NEXT_PUBLIC_SERVER_URL must be a valid absolute backend URL.");
    }

    const hasUnsafeParts =
      Boolean(parsed.username) ||
      Boolean(parsed.password) ||
      Boolean(parsed.search) ||
      Boolean(parsed.hash);

    // Never let a missing/misconfigured production variable point browser code
    // at localhost, Railway's private network, HTTP, or a URL with credentials.
    if (
      isProduction &&
      (parsed.protocol !== "https:" ||
        isPrivateOrLocalHost(parsed.hostname) ||
        hasUnsafeParts)
    ) {
      return DEFAULT_PRODUCTION_SERVER_URL;
    }

    if (hasUnsafeParts) {
      throw new Error(
        "NEXT_PUBLIC_SERVER_URL must not contain credentials, query parameters, or fragments."
      );
    }

    if (isProduction && parsed.protocol !== "https:") {
      return DEFAULT_PRODUCTION_SERVER_URL;
    }

    return configured;
  }

  if (isProduction) return DEFAULT_PRODUCTION_SERVER_URL;

  // Local development fallback.
  if (typeof window === "undefined") return "http://localhost:4000";

  const host = window.location.hostname;

  if (host === "localhost" || host === "127.0.0.1") {
    return "http://localhost:4000";
  }

  // LAN development (e.g. a phone on the same Wi-Fi).
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) {
    return `${window.location.protocol}//${host}:4000`;
  }

  // In development, keep a visible localhost fallback.
  return "http://localhost:4000";
}

export function makeRandomName(): string {
  const A = ["Silent","Red","Dark","Crimson","Night","Shadow","Iron","Neon","Quiet","Hollow","Frozen","Lost"];
  const N = ["Wolf","Shadow","Fox","Ghost","Crow","Raven","Serpent","Cipher","Echo","Drift","Nomad","Wraith"];
  const a = A[Math.floor(Math.random() * A.length)];
  const n = N[Math.floor(Math.random() * N.length)];
  return `${a}${n}${Math.floor(100 + Math.random() * 900)}`;
}
