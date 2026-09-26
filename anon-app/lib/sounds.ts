// Lightweight synthesized sounds — no external files.

type SoundType = "door" | "message" | "invite" | "join" | "leave" | "toast" | "error";

let ctx: AudioContext | null = null;
let unlocked = false;
let muted = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
}

export function unlockAudio() {
  if (unlocked) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") {
    c.resume().catch(() => {});
  }
  try {
    const o = c.createOscillator();
    const g = c.createGain();
    g.gain.value = 0.0001;
    o.connect(g);
    g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.01);
  } catch {
    /* ignore */
  }
  unlocked = true;
}

export function setMuted(m: boolean) {
  muted = m;
}

export function isMuted() {
  return muted;
}

function tone(
  freq: number,
  duration: number,
  gain: number,
  type: OscillatorType = "sine",
  delay = 0
) {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  o.connect(g);
  g.connect(c.destination);
  o.start(t0);
  o.stop(t0 + duration + 0.02);
}

export function playSound(type: SoundType) {
  if (muted) return;
  const c = getCtx();
  if (!c || c.state !== "running") return;

  switch (type) {
    case "door":
      tone(440, 0.35, 0.08, "sine");
      tone(330, 0.45, 0.06, "sine", 0.05);
      tone(220, 0.55, 0.05, "sine", 0.1);
      break;
    case "message":
      tone(880, 0.15, 0.06, "sine");
      tone(1320, 0.2, 0.05, "sine", 0.08);
      break;
    case "invite":
      tone(660, 0.15, 0.07, "sine");
      tone(880, 0.15, 0.07, "sine", 0.1);
      tone(1100, 0.25, 0.06, "sine", 0.2);
      break;
    case "join":
      tone(550, 0.12, 0.05, "sine");
      tone(770, 0.15, 0.04, "sine", 0.08);
      break;
    case "leave":
      tone(770, 0.12, 0.04, "sine");
      tone(550, 0.15, 0.05, "sine", 0.08);
      break;
    case "toast":
      tone(1000, 0.08, 0.04, "triangle");
      break;
    case "error":
      tone(220, 0.2, 0.06, "square");
      tone(180, 0.3, 0.05, "square", 0.1);
      break;
  }
}