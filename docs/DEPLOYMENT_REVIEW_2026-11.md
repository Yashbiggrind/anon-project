# ANON Deployment Review — 2026-11-03

**Status:** Read-only infrastructure review. No Railway service, variable, volume, deployment or domain was changed by this review.
**Application repository:** `Yashbiggrind/anon-project`
**Reviewed source branch:** `main` and draft PR branch `anon-privacy-foundation-2026-10`

## Executive result

The frontend and backend deployment paths must be treated separately:

- **Frontend:** Vercel project integration reports the ANON app root as `anon-app`. The PR #12 preview was reported Ready on 2026-10-29. A new documentation commit was pushed to the draft PR on 2026-11-03; the integration's latest status for that new commit was Pending at the time of this check. Verify the exact preview deployment before calling it ready.
- **Backend candidate:** In Railway project `upbeat-mercy`, service `balanced-creativity` is configured to source `Yashbiggrind/anon-project`, branch `main`, root directory `/anon-server`. Its environment contains the expected backend variable names (values were not read). It has a Railway service domain configured on port 8080.
- **Other Railway services:** two additional services named `anon-project` point at the repository root rather than the backend subdirectory. Neither is configured with the backend environment variable set. They are not viable backend configurations as currently observed.

## Railway findings

### 1. `upbeat-mercy / balanced-creativity` — likely backend service

Observed configuration:
- Source repository: `Yashbiggrind/anon-project`
- Branch: `main`
- Root directory: `/anon-server`
- Builder: Railpack
- Node runtime detected in the failed build: Node 22.23.3; backend package requires Node >=22.13.0.
- Railway detected a custom start command and npm package manager.
- Backend variable names are present, including `CLIENT_ORIGIN`, `SERVER_ORIGIN`, `ADMIN_TOKEN`, `IP_HASH_SECRET`, `PORT` and other app settings. This review did not retrieve or disclose their values.

Observed latest deployment:
- Status: `FAILED`
- Date: 2026-10-28
- Failure stage: `BUILD_IMAGE`
- Build log ended with a BuildKit daemon/worker connection error: `error reading server preface ... use of closed network connection`.
- No application compile output or Node server startup failure was present in the returned log excerpt.

**Interpretation:** The observed failure is consistent with a Railway builder/BuildKit infrastructure failure, not evidence of a Node application error. This deployment is several days old; current deployment state must be refreshed before a retry.

### 2. `upbeat-mercy / anon-project` — misconfigured duplicate

Observed configuration:
- Sources the same repository and `main` branch.
- Root directory is not set to `/anon-app` or `/anon-server`.
- No start command was configured.
- Railway log: `No start command detected`.
- No backend variable names were configured.

**Interpretation:** The repository root is a monorepo containing separate `anon-app` and `anon-server` projects, not a deployable single Node application. This service is not the backend candidate in its current configuration.

### 3. `dependable-youthfulness / anon-project` — misconfigured duplicate

Observed configuration:
- Sources the same repository and `main` branch.
- Root directory is not set to an app subdirectory.
- No backend environment variable names were configured.
- Railpack could not determine how to build the repository root because the root contains project folders rather than a root-level application package.

**Interpretation:** This is another root-of-monorepo service, not a valid backend configuration as currently observed.

## Safe recovery sequence

1. Confirm the intended Railway project and production service with the operator before making changes. Do not delete duplicate services based only on their names.
2. Re-read current Railway state and confirm `upbeat-mercy / balanced-creativity` still points at `/anon-server`, has the intended environment, and retains all required variables.
3. Confirm the actual Vercel production frontend origin and the backend domain. Compare them with `CLIENT_ORIGIN` and `SERVER_ORIGIN` without printing secret values.
4. Retry/redeploy only the confirmed backend service after verifying that the October 28 builder failure is not still active. Confirm the result reaches Railway `SUCCESS`.
5. Inspect runtime health and logs, then test the real Vercel frontend against the backend over HTTPS/WSS, including Socket.IO connect, send/receive, reconnect, room join, invite and CORS rejection for an unapproved origin.
6. Only after successful verification, decide whether to archive or remove duplicate services. Removal is destructive and is not part of this review.

## Release gate

A green frontend preview/build does not prove the backend is live. A successful Railway deployment does not prove that Vercel is using the correct backend URL. ANON should not be called production-healthy until both sides are verified together using the exact deployed commit and production environment.

