/** @type {import('next').NextConfig} */
const apiUrl = process.env.NEXT_PUBLIC_SERVER_URL || "";
const isDevelopment = process.env.NODE_ENV === "development";
const scriptSources = isDevelopment
  ? "'self' 'unsafe-inline' 'unsafe-eval'"
  : "'self' 'unsafe-inline'";

function socketConnectSources() {
  if (!apiUrl) {
    return isDevelopment
      ? "http://localhost:4000 ws://localhost:4000 http://127.0.0.1:4000 ws://127.0.0.1:4000"
      : "";
  }
  try {
    const url = new URL(apiUrl);
    const wsScheme = url.protocol === "https:" ? "wss:" : "ws:";
    return `${url.origin} ${wsScheme}//${url.host}`;
  } catch {
    // Invalid backend URL should fail visibly in deployment checks, not widen CSP.
    return "";
  }
}

const connectSources = socketConnectSources();
const csp = [
  "default-src 'self'",
  "script-src " + scriptSources,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' " + connectSources,
  "media-src 'self' blob: data:",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig = {
  reactStrictMode: true,

  allowedDevOrigins: [
    "localhost:3000",
    "127.0.0.1:3000",
    "10.216.30.179:3000",
    "10.216.30.179",
    "192.168.137.1:3000",
    "192.168.137.1",
  ],

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
