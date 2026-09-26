// Footprint with rolling cohort decay.
//
// Model:
//   • Every ACTIVE day adds a new cohort of 100 units.
//   • Every hour, each cohort OLDER than 24h loses 3% / 24 = 0.125% of remaining.
//   • Old cohorts shrink toward zero. New ones stay fresh.
//   • Bar shows: total ever generated vs total ever deleted.

const FP_KEY = "anon_footprint_v2";
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const DAILY_DECAY = 0.03;
const HOURLY_DECAY = DAILY_DECAY / 24;
const DAILY_GRANT = 100;
const GRACE_MS = DAY_MS;

export type Cohort = {
  dayIndex: number;
  createdAt: number;
  created: number;
  current: number;
  deleted: number;
};

export type FootprintState = {
  startedAt: number;
  totalGenerated: number;
  totalDeleted: number;
  cohorts: Cohort[];
  lastTickAt: number;
  lastActiveDayIndex: number;
};

function read(): FootprintState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(FP_KEY);
    if (!raw) return null;
    const fp = JSON.parse(raw) as FootprintState;
    if (!fp || typeof fp.startedAt !== "number" || !Array.isArray(fp.cohorts)) return null;
    return fp;
  } catch {
    return null;
  }
}
function write(fp: FootprintState) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(FP_KEY, JSON.stringify(fp)); } catch {}
}

function create(): FootprintState {
  const now = Date.now();
  const fp: FootprintState = {
    startedAt: now,
    totalGenerated: 0,
    totalDeleted: 0,
    cohorts: [],
    lastTickAt: now,
    lastActiveDayIndex: 0,
  };
  fp.cohorts.push({
    dayIndex: 0,
    createdAt: now,
    created: DAILY_GRANT,
    current: DAILY_GRANT,
    deleted: 0,
  });
  fp.totalGenerated += DAILY_GRANT;
  return fp;
}

export function tickFootprint(active = true): FootprintState {
  const now = Date.now();
  let fp = read() || create();

  const todayIndex = Math.floor((now - fp.startedAt) / DAY_MS);
  if (active && todayIndex > fp.lastActiveDayIndex) {
    fp.cohorts.push({
      dayIndex: todayIndex,
      createdAt: now,
      created: DAILY_GRANT,
      current: DAILY_GRANT,
      deleted: 0,
    });
    fp.totalGenerated += DAILY_GRANT;
    fp.lastActiveDayIndex = todayIndex;
  }

  const hoursToApply = Math.floor((now - fp.lastTickAt) / HOUR_MS);
  if (hoursToApply > 0) {
    for (let h = 0; h < hoursToApply; h++) {
      const tickAt = fp.lastTickAt + (h + 1) * HOUR_MS;
      for (const c of fp.cohorts) {
        if (tickAt - c.createdAt < GRACE_MS) continue;
        if (c.current <= 0) continue;
        const cut = c.current * HOURLY_DECAY;
        c.current -= cut;
        c.deleted += cut;
        fp.totalDeleted += cut;
      }
    }
    fp.lastTickAt += hoursToApply * HOUR_MS;
  }

  const newest = fp.cohorts[fp.cohorts.length - 1];
  fp.cohorts = fp.cohorts.filter((c) => c.current > 0.005 || c === newest);

  if (fp.cohorts.length > 60) fp.cohorts = fp.cohorts.slice(-60);

  write(fp);
  return fp;
}

export function getFootprint(): FootprintState {
  return read() || tickFootprint();
}

export type FootprintStats = {
  pctDeleted: number;
  pctRemaining: number;
  unitsHeld: number;
  unitsGenerated: number;
  unitsDeleted: number;
  daysAlive: number;
  nextDecayInMs: number;
  nextDayInMs: number;
  fullyDeleted: boolean;
  startedAt: number;
  cohorts: Cohort[];
  oldestAlive: number;
  newestAlive: number;
};

export function computeStats(fp: FootprintState, now = Date.now()): FootprintStats {
  const unitsHeld = fp.cohorts.reduce((s, c) => s + c.current, 0);
  const pctDeleted = fp.totalGenerated > 0
    ? Math.min(100, (fp.totalDeleted / fp.totalGenerated) * 100)
    : 0;
  const pctRemaining = 100 - pctDeleted;
  const daysAlive = Math.floor((now - fp.startedAt) / DAY_MS);

  const sinceTick = now - fp.lastTickAt;
  const nextDecayInMs = Math.max(0, HOUR_MS - (sinceTick % HOUR_MS));

  const sinceStart = now - fp.startedAt;
  const nextDayInMs = Math.max(0, DAY_MS - (sinceStart % DAY_MS));

  const oldestAlive = fp.cohorts.length > 0 ? fp.cohorts[0].current : 0;
  const newestAlive = fp.cohorts.length > 0 ? fp.cohorts[fp.cohorts.length - 1].current : 0;

  return {
    pctDeleted,
    pctRemaining,
    unitsHeld,
    unitsGenerated: fp.totalGenerated,
    unitsDeleted: fp.totalDeleted,
    daysAlive,
    nextDecayInMs,
    nextDayInMs,
    fullyDeleted: unitsHeld < 0.01,
    startedAt: fp.startedAt,
    cohorts: fp.cohorts,
    oldestAlive,
    newestAlive,
  };
}

export function resetFootprint() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(FP_KEY);
}

export function formatCountdown(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}