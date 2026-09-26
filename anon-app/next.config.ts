/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Allow dev server access from LAN devices (phones/tablets).
  // Next.js 16 + Turbopack requires the EXACT host (no wildcards).
  allowedDevOrigins: [
    "localhost:3000",
    "127.0.0.1:3000",
    "10.216.30.179:3000",     // ← your laptop's current Wi-Fi IP
    "10.216.30.179",
    "192.168.137.1:3000",     // ← in case you switch to Windows Hotspot
    "192.168.137.1",
  ],
};

module.exports = nextConfig;