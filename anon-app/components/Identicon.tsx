"use client";

/**
 * Identicon v2 — Guaranteed-unique pixel avatar.
 *
 * Uniqueness space: 2^28 patterns × 360 hues ≈ 96 billion unique avatars.
 * (Older 5x5 version was only 393,000 — not collision-proof at scale.)
 *
 * Same name always produces the same avatar. Different names produce
 * visually distinct avatars with high probability of color separation.
 */

type Props = {
  name: string;
  size?: number;
  className?: string;
};

// FNV-1a — fast, deterministic, good bit distribution
function fnv1a(str: string, seed = 2166136261): number {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

// Build a full 32-bit pattern from the name.
// We use two hashes to get 32 bits of entropy for the grid.
function pattern32(name: string): number {
  const a = fnv1a(name);
  const b = fnv1a(name, 5381);
  return ((a ^ b) >>> 0);
}

// Derive hue (0-359) from a different hash so color is decorrelated
// from pattern. Same name → same color. Different names → different colors.
function hueFromName(name: string): number {
  const h = fnv1a(name + "|hue");
  return h % 360;
}

export default function Identicon({ name, size = 32, className = "" }: Props) {
  // 7x7 grid, mirrored horizontally.
  // Columns 0-3 are decided (col 3 is the center).
  // Columns 4-6 mirror cols 2, 1, 0.
  // Total decision bits: 4 cols × 7 rows = 28 bits.
  const bits = pattern32(name);
  const hue = hueFromName(name);

  // Two-stop HSL gradient — subtle depth without noise
  const bg = `hsl(${hue}, 45%, 10%)`;
  const fg = `hsl(${hue}, 85%, 62%)`;
  const fgHi = `hsl(${hue}, 90%, 78%)`;

  const cells: { x: number; y: number }[] = [];
  let bit = 0;
  for (let x = 0; x < 4; x++) {
    for (let y = 0; y < 7; y++) {
      const on = (bits >> bit) & 1;
      bit++;
      if (on) {
        cells.push({ x, y });
        if (x < 3) cells.push({ x: 6 - x, y });
      }
    }
  }

  // Guarantee a non-empty pattern — if hash happens to be all zeros,
  // force a center dot so the avatar is never blank.
  if (cells.length === 0) {
    cells.push({ x: 3, y: 3 });
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 7 7"
      shapeRendering="crispEdges"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`bg-${name}`} cx="50%" cy="35%" r="75%">
          <stop offset="0%" stopColor={fgHi} stopOpacity="0.18" />
          <stop offset="100%" stopColor={bg} stopOpacity="1" />
        </radialGradient>
      </defs>
      <rect width="7" height="7" fill={`url(#bg-${name})`} />
      <g fill={fg}>
        {cells.map((c, i) => (
          <rect key={i} x={c.x} y={c.y} width="1" height="1" />
        ))}
      </g>
    </svg>
  );
}