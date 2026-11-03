export const AVATAR_GRID_SIZE = 7;
export const AVATAR_MIN_GRID_SIZE = 4;
export const AVATAR_MAX_GRID_SIZE = 32;
export const AVATAR_CELL_COUNT = AVATAR_GRID_SIZE * AVATAR_GRID_SIZE;
export const AVATAR_SESSION_KEY = "anon.avatar.design.v2";
export const AVATAR_PROFILE_TOKEN_KEY = "anon.avatar.profile-token.v1";
const LEGACY_AVATAR_SESSION_KEY = "anon.avatar.design.v1";
const AVATAR_CACHE_KEY = "anon.avatar.cache.v1";

export const AVATAR_PALETTE = [
  "#ffb84d", "#56d8ff", "#ff4f7f", "#9aef61",
  "#b9a0ff", "#ffe45b", "#ff8960", "#53e2b7",
  "#78a7ff", "#ff91cd", "#d5f263", "#8ce8f2",
  "#ffa45e", "#c5efff", "#ee74b2", "#a5ef77",
  "#17070d", "#10070b",
] as const;

export type AvatarDesign = {
  background: string;
  /** Original editor grid size (4–32). Never downsample the saved design. */
  gridSize: number;
  cells: Array<string | null>;
};

type CachedAvatars = {
  profiles?: Record<string, unknown>;
  sessions?: Record<string, string>;
};

const isHexColor = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
const listeners = new Set<() => void>();
const designs = new Map<string, AvatarDesign | null>();
const sessionProfiles = new Map<string, string>();
let cacheLoaded = false;

function inferGridSize(cells: unknown[]): number {
  const size = Math.sqrt(cells.length);
  return Number.isInteger(size) ? size : 0;
}

export function sanitizeAvatarDesign(value: unknown): AvatarDesign | null {
  if (!value || typeof value !== "object") return null;
  const input = value as { background?: unknown; gridSize?: unknown; cells?: unknown };
  if (!isHexColor(input.background) || !Array.isArray(input.cells)) return null;
  const inferred = inferGridSize(input.cells);
  const gridSize = Number.isInteger(input.gridSize) ? Number(input.gridSize) : inferred;
  if (
    gridSize < AVATAR_MIN_GRID_SIZE ||
    gridSize > AVATAR_MAX_GRID_SIZE ||
    input.cells.length !== gridSize * gridSize
  ) return null;

  const cells = input.cells.map((cell) => {
    if (cell === null || cell === undefined || cell === "") return null;
    return isHexColor(cell) ? cell.toLowerCase() : null;
  });
  return { background: input.background.toLowerCase(), gridSize, cells };
}

function notify() {
  listeners.forEach((listener) => listener());
}

function ensureCacheLoaded() {
  if (cacheLoaded || typeof window === "undefined") return;
  cacheLoaded = true;
  try {
    const raw = window.localStorage.getItem(AVATAR_CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as CachedAvatars;
    for (const [profileId, value] of Object.entries(parsed.profiles ?? {}).slice(-30)) {
      designs.set(profileId, sanitizeAvatarDesign(value));
    }
    for (const [sessionId, profileId] of Object.entries(parsed.sessions ?? {}).slice(-120)) {
      if (sessionId && profileId) sessionProfiles.set(sessionId, profileId);
    }
  } catch {
    // Corrupt or unavailable cache must never stop chat rendering.
  }
}

function persistAvatarCache() {
  if (typeof window === "undefined") return;
  try {
    const profiles = Object.fromEntries(
      Array.from(designs.entries()).filter(([key]) => key.startsWith("profile_")).slice(-30)
    );
    const sessions = Object.fromEntries(Array.from(sessionProfiles.entries()).slice(-120));
    window.localStorage.setItem(AVATAR_CACHE_KEY, JSON.stringify({ profiles, sessions }));
  } catch {
    // The live in-memory store remains available when storage is full or restricted.
  }
}

function rememberAvatar(sessionId: string | undefined, profileId: string | undefined, value: unknown) {
  ensureCacheLoaded();
  const key = profileId || sessionId;
  const next = value === null ? null : sanitizeAvatarDesign(value);
  if (sessionId && profileId) sessionProfiles.set(sessionId, profileId);
  if (key) designs.set(key, next);
  if (sessionId && !profileId) designs.set(sessionId, next);
  persistAvatarCache();
  notify();
}

export function getAvatarDesign(seed: string): AvatarDesign | null | undefined {
  ensureCacheLoaded();
  if (designs.has(seed)) return designs.get(seed);
  const profileId = sessionProfiles.get(seed);
  return profileId ? designs.get(profileId) : undefined;
}

export function subscribeAvatarDesign(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setAvatarDesignForSession(
  sessionId: string,
  value: unknown,
  profileId?: string,
): void {
  if (!sessionId) return;
  rememberAvatar(sessionId, profileId, value);
}

export function setOwnAvatarSession(
  sessionId: string,
  value: unknown,
  profileId?: string,
): void {
  if (!sessionId) return;
  rememberAvatar(sessionId, profileId, value);
}

export function syncAvatarPresence(
  users: Array<{ sessionId: string; profileId?: string | null; avatarDesign?: unknown }>
): void {
  ensureCacheLoaded();
  for (const user of users) {
    if (!user?.sessionId) continue;
    // Preserve aliases from prior sessions. When this same anonymous profile
    // reconnects with a new sessionId, its previous chat rows resolve to the
    // same stable profile avatar.
    if (user.profileId) sessionProfiles.set(user.sessionId, user.profileId);
    const key = user.profileId || user.sessionId;
    if (Object.prototype.hasOwnProperty.call(user, "avatarDesign")) {
      designs.set(key, user.avatarDesign === null ? null : sanitizeAvatarDesign(user.avatarDesign));
    }
  }
  persistAvatarCache();
  notify();
}

export function loadSessionAvatarDesign(): AvatarDesign | null {
  if (typeof window === "undefined") return null;
  try {
    const current = window.localStorage.getItem(AVATAR_SESSION_KEY);
    if (current) return sanitizeAvatarDesign(JSON.parse(current));

    // Migrate designs saved by the earlier tab-only implementation.
    const legacy = window.sessionStorage.getItem(LEGACY_AVATAR_SESSION_KEY);
    if (legacy) {
      const migrated = sanitizeAvatarDesign(JSON.parse(legacy));
      if (migrated) {
        window.localStorage.setItem(AVATAR_SESSION_KEY, JSON.stringify(migrated));
        return migrated;
      }
    }
    const legacyLocal = window.localStorage.getItem(LEGACY_AVATAR_SESSION_KEY);
    if (legacyLocal) {
      const migrated = sanitizeAvatarDesign(JSON.parse(legacyLocal));
      if (migrated) {
        window.localStorage.setItem(AVATAR_SESSION_KEY, JSON.stringify(migrated));
        return migrated;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function saveSessionAvatarDesign(value: AvatarDesign | null): void {
  if (typeof window === "undefined") return;
  try {
    if (value === null) window.localStorage.removeItem(AVATAR_SESSION_KEY);
    else {
      const safe = sanitizeAvatarDesign(value);
      if (safe) window.localStorage.setItem(AVATAR_SESSION_KEY, JSON.stringify(safe));
    }
    window.sessionStorage.removeItem(LEGACY_AVATAR_SESSION_KEY);
  } catch {
    // A restricted storage context should not prevent the in-memory avatar from working.
  }
}

/**
 * Stable anonymous bearer token for this browser profile.
 * The raw token stays in localStorage and is never broadcast to other users.
 * The backend derives a non-secret public profileId from its SHA-256 digest.
 */
export function getAvatarProfileToken(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(AVATAR_PROFILE_TOKEN_KEY) || "";
    if (/^[a-f0-9]{32,64}$/i.test(existing)) return existing.toLowerCase();

    let token = "";
    const bytes = new Uint8Array(32);
    if (window.crypto?.getRandomValues) {
      window.crypto.getRandomValues(bytes);
      token = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
    } else if (window.crypto?.randomUUID) {
      token = window.crypto.randomUUID().replace(/-/g, "");
    }
    if (!token) throw new Error("Secure random identity generation is unavailable.");
    window.localStorage.setItem(AVATAR_PROFILE_TOKEN_KEY, token);
    return token;
  } catch {
    // If persistent storage is disabled, use an ephemeral identity token.
    return "";
  }
}
