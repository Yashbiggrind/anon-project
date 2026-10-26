# ANON// - Backend

Node.js + Express + Socket.io backend for the ANON anonymous chat app.

## Stack

- **Node.js 22.13+** (the server uses the built-in `node:sqlite` module)
- Node.js
- Express
- Socket.io
- SQLite (node:sqlite)

## Environment Variables
Create .env in this folder with:
PORT=4000
CLIENT_ORIGIN=http://localhost:3000
ADMIN_TOKEN=replace-with-a-random-secret-at-least-32-characters
IP_HASH_SECRET=replace-with-a-different-random-secret-at-least-32-characters
TRUST_PROXY=false
MAX_MSG_LENGTH=1000
RATE_MSG_PER_10S=15
RATE_INVITE_PER_MIN=5
RATE_ROOM_CREATE_PER_MIN=3

## Run locally
npm install
node index.js

## Production security checklist

- Set `CLIENT_ORIGIN` to the exact HTTPS frontend origin (comma-separated only if multiple origins are intentionally supported). Wildcard origins are rejected in production.
- Set `ADMIN_TOKEN` and `IP_HASH_SECRET` to separate, high-entropy random values of at least 32 characters. The server refuses production startup when either is missing/weak.
- Leave `TRUST_PROXY=false` unless your hosting ingress is configured to overwrite/sanitize `X-Forwarded-For`; only then enable it.
- Ensure persistent database files, platform logs, and backups have restricted access and a documented retention policy. The app can hash its own connection metadata but cannot control a provider's logs.
- The admin page accepts the token in a password field; API requests send it in a header. Never share the token or append it to a URL.

## Deploy
Deploy to Railway, Render, or Fly.io. Configure all environment variables on the platform and verify the production proxy behavior before enabling `TRUST_PROXY`.
