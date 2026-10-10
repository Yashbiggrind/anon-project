# ANON// - Backend

Node.js + Express + Socket.io backend for the ANON anonymous chat app.

## Stack
- Node.js
- Express
- Socket.io
- SQLite (node:sqlite)

## Environment Variables
Create .env in this folder with:
PORT=4000
CLIENT_ORIGIN=*
ADMIN_TOKEN=your-secret-token
IP_HASH_SECRET=your-hmac-secret
MAX_MSG_LENGTH=1000
RATE_MSG_PER_10S=15
RATE_INVITE_PER_MIN=5
RATE_ROOM_CREATE_PER_MIN=3

## Run locally
npm install
node index.js

## Deploy
Deploy to Railway, Render, or Fly.io. Set env vars on the platform.
