export const AVATAR_GRID_SIZE = 7;
export const AVATAR_CELL_COUNT = AVATAR_GRID_SIZE * AVATAR_GRID_SIZE;
export const AVATAR_SESSION_KEY = "anon.avatar.design.v1";

export const AVATAR_PALETTE = [
  "#ffb84d", "#56d8ff", "#ff4f7f", "#9aef61",
  "#b9a0ff", "#ffe45b", "#ff8960", "#53e2b7",
  "#78a7ff", "#ff91cd", "#d5f263", "#8ce8f2",
  "#ffa45e", "#c5efff", "#ee74b2", "#a5ef77",
  "#17070d", "#10070b",
] as const;

export type AvatarDesign = {
  background: string;
  cells: Array<string | null>;
};

const isHexColor = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
const listeners = new Set<() => void>();
const designs = new Map<string, AvatarDesign>();
let ownSessionId: string | null = null;

function equalDesign(a: AvatarDesign | null, b: AvatarDesign | null): boolean {
  return a === b || (!!a && !!b && a.background === b.background &&
    a.cells.length === b.cells.length && a.cells.every((cell, i) => cell === b.cells[i]));
}

function notify() {
  listeners.forEach((listener) => listener());
}

export function sanitizeAvatarDesign(value: unknown): AvatarDesign | null {
  if (!value || typeof value !== "object") return null;
  const input = value as { background?: unknown; cells?: unknown };
  if (!isHexColor(input.background)) return null;
  if (!Array.isArray(input.cells) || input.cells.length !== AVATAR_CELL_COUNT) return null;
  const cells = input.cells.map((cell) => {
    if (cell === null || cell === undefined || cell === "") return null;
    return isHexColor(cell) ? cell.toLowerCase() : null;
  });
  return { background: input.background.toLowerCase(), cells };
}

export function getAvatarDesign(seed: string): AvatarDesign | null {
  return designs.get(seed) ?? null;
}

export function subscribeAvatarDesign(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setAvatarDesignForSession(sessionId: string, value: unknown): void {
  if (!sessionId) return;
  const next = value === null ? null : sanitizeAvatarDesign(value);
  const current = designs.get(sessionId) ?? null;
  if (equalDesign(current, next)) return;
  if (next) designs.set(sessionId, next);
  else designs.delete(sessionId);
  notify();
}

export function setOwnAvatarSession(sessionId: string, value: unknown): void {
  ownSessionId = sessionId || null;
  if (ownSessionId) setAvatarDesignForSession(ownSessionId, value);
}

export function syncAvatarPresence(users: Array<{ sessionId: string; avatarDesign?: unknown }>): void {
  const next = new Map<string, AvatarDesign>();
  if (ownSessionId) {
    const mine = designs.get(ownSessionId);
    if (mine) next.set(ownSessionId, mine);
  }
  for (const user of users) {
    if (!user?.sessionId || user.sessionId === ownSessionId) continue;
    const design = sanitizeAvatarDesign(user.avatarDesign);
    if (design) next.set(user.sessionId, design);
  }
  const same = next.size === designs.size && Array.from(next.entries()).every(([key, value]) =>
    equalDesign(designs.get(key) ?? null, value));
  if (same) return;
  designs.clear();
  next.forEach((value, key) => designs.set(key, value));
  notify();
}

export function loadSessionAvatarDesign(): AvatarDesign | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(AVATAR_SESSION_KEY);
    return raw ? sanitizeAvatarDesign(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveSessionAvatarDesign(value: AvatarDesign | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!value) window.sessionStorage.removeItem(AVATAR_SESSION_KEY);
    else window.sessionStorage.setItem(AVATAR_SESSION_KEY, JSON.stringify(value));
  } catch {
    // A restricted storage context should not prevent the in-memory avatar from working.
  }
}
