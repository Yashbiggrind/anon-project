# ANON deployment recovery guide (Vercel + Railway)

This guide addresses the production **“Connection lost — reconnecting”** banner without changing chat features or weakening the existing security checks.

## Safety rules

- Do not merge an old/stale pull request to fix this symptom. Verify it against current `main` first.
- Do not delete any Railway service until the selected backend is confirmed healthy and the live frontend is connected to it.
- Do not put `ADMIN_TOKEN` or `IP_HASH_SECRET` in GitHub, Vercel, browser code, screenshots, or chat messages. Generate and enter them directly in Railway.
- Do not set `CLIENT_ORIGIN=*`, loosen the Content Security Policy, or disable CORS to make the banner disappear.
- These steps change hosting configuration, not app features. Make a copy of existing values before editing them so they can be restored if needed.

## Repository layout

This is a monorepo. The repository root intentionally has no root `package.json`.

- Frontend: `anon-app/` — Next.js, deployed to Vercel.
- Backend: `anon-server/` — Express + Socket.IO + Node's built-in SQLite API, deployed to Railway.
- Railway backend root directory: `/anon-server`.
- Vercel frontend root directory: `anon-app`.
- The backend package declares Node `>=22.13.0`; check the actual deploy log/runtime meets this requirement.

## 1. Identify the correct Railway backend first

There may be multiple Railway services named similarly. Do not delete or repoint any yet.

For each candidate service, inspect **Settings → Source** and record:
- Repository: `Yashbiggrind/anon-project`
- Branch: `main` (unless you intentionally deploy a tested branch)
- Root Directory: `/anon-server`
- Start command, if overridden: `npm start`

Then inspect the latest deployment logs. The selected service must be running the expected backend code and successfully start. A failed/old service or a service sourced from another repository is not the backend to configure.

Under **Settings → Networking**, generate or identify that service's public HTTPS domain. Record it exactly, such as `https://<your-service>.up.railway.app`. Do not use the placeholder literally.

## 2. Set Railway backend variables

In **Railway → the verified backend service → Variables**, configure these values:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `CLIENT_ORIGIN` | The exact public Vercel frontend origin, for example `https://your-app.vercel.app`; no trailing slash |
| `SERVER_ORIGIN` | The exact public Railway backend origin, for example `https://your-service.up.railway.app`; no trailing slash |
| `ADMIN_TOKEN` | A unique random secret, at least 32 characters |
| `IP_HASH_SECRET` | A different unique random secret, at least 32 characters |

The code supports comma-separated **exact** origins if you have more than one stable frontend/custom domain. Add only origins you actually use. Do not use `*`. Preview deployment URLs can change, so do not assume every Vercel preview is allowed by this exact-origin list.

To generate each secret locally in PowerShell, run this command twice (one output for each variable). Keep the outputs private and paste them directly into Railway:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Do not reuse the same secret for both values. Do not put either secret in `anon-app` or a `NEXT_PUBLIC_*` variable.

### TRUST_PROXY

Leave `TRUST_PROXY` unset or `false` until you have verified that the hosting ingress overwrites/sanitizes `X-Forwarded-For`. The backend deliberately ignores forwarded IP headers by default because clients can spoof them. However, if the socket's peer address is only the proxy address, shared rate limits may affect many users. Verify the proxy behavior before enabling this setting; do not blindly trust a client-supplied header.

### SQLite persistence (optional but important for records)

The default SQLite file lives beside the backend code. Railway's container filesystem may be replaced during redeploys, so reports, anti-spam strike records, and the 180-day connection log may be lost unless the database is on a persistent volume.

If you need those records to survive redeploys, attach a Railway volume at a mount path such as `/data` and set `ANON_DB_PATH=/data/anon.db` so the application uses a database file on that mounted volume. Confirm the mount path and permissions in Railway. Do not set `ANON_DB_PATH` to `/data/anon.db` unless the volume is actually mounted there.

Important: chat rooms, direct-message threads, online sessions, and confession posts are held in process memory; a SQLite volume does not make those in-memory features persistent. Confessions expire after seven days during normal operation, but memory-only posts are lost on a process restart.

## 3. Verify Railway before changing Vercel

Open the backend's exact HTTPS root URL in a browser:

```text
https://<your-service>.up.railway.app/
```

It should return JSON with `ok: true` (plus current online/room counts). Check the latest Railway logs for database initialization (for example, `[db] ready at ...`), successful listening, and the line reporting the allowed CORS origins.

If the health route is not healthy, stop here and fix the Railway deployment/log error first. Do not try to solve a crashed backend by changing frontend CSS or removing app features.

## 4. Configure Vercel frontend

In **Vercel → the project connected to `Yashbiggrind/anon-project` → Settings → General**:
- Root Directory: `anon-app`
- Ensure the intended Git repository and branch are connected. Confirm the Vercel account/project is one you control.

In **Settings → Environment Variables**, set:

| Variable | Environment | Value |
| --- | --- | --- |
| `NEXT_PUBLIC_SERVER_URL` | Production | The verified Railway backend HTTPS origin, e.g. `https://<your-service>.up.railway.app`, without a trailing slash |
| `NEXT_PUBLIC_SERVER_URL` | Preview (only if you use Preview deployments) | The backend HTTPS origin that preview builds should contact |

Do **not** set `NEXT_PUBLIC_SERVER_URL` to the Vercel frontend URL. It must point to the backend. This variable is intentionally public (it is just a server address), not a secret. Never store the admin token or IP hash secret in Vercel.

The backend's `CLIENT_ORIGIN` must allow the exact frontend origin you test. If using a Preview URL, that specific origin must be allowlisted by the backend; adding a Vercel environment variable alone does not bypass CORS.

After saving the variable, trigger a **new deployment/build** for the appropriate environment. Next.js inlines `NEXT_PUBLIC_*` values at build time, and `next.config.ts` builds the Content Security Policy's `connect-src` from this same backend URL. A redeploy is required for the new setting to take effect. Clearing the build cache is not normally necessary; only try that later if a fresh build still appears to use the old value.

## 5. End-to-end verification

Use the exact production Vercel domain you intend people to visit.

1. Backend root returns JSON containing `"ok":true`.
2. Railway logs show the service stays running and the allowed-origin line includes the exact frontend origin.
3. Vercel's latest deployment was built **after** `NEXT_PUBLIC_SERVER_URL` was set, and the deployment root directory is `anon-app`.
4. Open the frontend in a private/incognito window or hard-refresh it. Open browser Developer Tools → **Console** and **Network**.
5. Confirm Socket.IO requests target the Railway host, not `localhost:4000`, an old Railway host, or the Vercel frontend. Look for Content Security Policy `connect-src`, CORS, DNS, TLS, and WebSocket errors.
6. Test real functionality: connect, send a public message, create/join a room, send a private-room message, and use confession feed/replies/votes if those features are enabled.
7. Repeat on the production domain. A successful Vercel build alone does not prove the backend is reachable.

## Common symptoms

- **Backend does not boot:** inspect Railway logs first; confirm root directory, Node runtime, required variables, and the start command.
- **CSP says connection blocked / client tries localhost:** set the correct Vercel `NEXT_PUBLIC_SERVER_URL` for the relevant environment and redeploy.
- **CORS blocked:** compare the browser's exact `Origin` to the comma-separated Railway `CLIENT_ORIGIN` allowlist. Origins include scheme and hostname and should not have a trailing slash.
- **Backend root works but Socket.IO fails:** inspect browser Network/Console plus Railway logs; verify the frontend URL, CORS allowlist, and CSP's `connect-src`.
- **Connection works but moderation/session records disappear after deploy:** configure a persistent volume and `ANON_DB_PATH` as described above.
- **All visitors appear to share rate limits:** investigate proxy peer-IP behavior and sanitized forwarding headers before deciding whether to enable `TRUST_PROXY`.

## Rollback and change log discipline

Before changing a provider variable, record its previous value in your own secure notes (never record secret values in this repository). If the new configuration fails, restore the previous known-good value and redeploy. Do not reset Git, delete files, merge a stale PR, or delete Railway services as a troubleshooting shortcut.

This guide does not claim that the live site has been repaired: Vercel and Railway settings must be verified in their dashboards, then the browser-level test above must pass.
