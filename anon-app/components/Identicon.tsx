"use client";

/**
 * ANON deterministic pixel identicon.
 *
 * Reference style: a solid vivid square, hard dark pixel blocks, sharp corners,
 * and no gradients or antialiasing. A stable identity seed keeps an avatar
 * consistent across screens; session IDs can be used as seeds without exposing
 * them in the rendered markup.
 */

type Props = {
  name: string;
  seed?: string;
  size?: number;
  className?: string;
};

function fnv1a(str: string, seed = 2166136261): number {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

// Bold, flat colors inspired by the ANON identity chooser reference.
const PALETTE = [
  "#ffb84d", // amber
  "#56d8ff", // cyan
  "#ff4f7f", // hot pink
  "#9aef61", // lime
  "#b9a0ff", // violet
  "#ffe45b", // bright yellow
  "#ff8960", // coral
  "#53e2b7", // mint
  "#78a7ff", // electric blue
  "#ff91cd", // candy pink
  "#d5f263", // acid lime
  "#8ce8f2", // ice teal
  "#ffa45e", // orange
  "#c5efff", // pale cyan
  "#ee74b2", // rose
  "#a5ef77", // neon green
];

const FRAME = "#17070d";
const PIXEL = "#10070b";
const GRID_MASK = 0x0fffffff;

function countBits(value: number): number {
  let v = value & GRID_MASK;
  let count = 0;
  while (v !== 0) {
    v &= v - 1;
    count++;
  }
  return count;
}

function makePattern(identity: string): number {
  // Retry very sparse or very dense masks so each avatar remains visually legible.
  for (let attempt = 0; attempt < 12; attempt++) {
    const variant = identity + "#pixel-grid-" + attempt;
    const bits = (fnv1a(variant) ^ fnv1a(identity, 5381)) & GRID_MASK;
    const density = countBits(bits);
    if (density >= 8 && density <= 20) return bits;
  }
  return (fnv1a(identity + "#pixel-grid-fallback") ^ 0x05a35c7d) & GRID_MASK;
}

export default function Identicon({
  name,
  seed,
  size = 32,
  className = "",
}: Props) {
  const identity = (seed?.trim() || name.trim() || "anon").normalize("NFKC");
  const color = PALETTE[fnv1a(identity + "#color") % PALETTE.length];
  const bits = makePattern(identity);

  // 7x7 mirrored pixel mask (28 independent decisions) inside a one-pixel frame.
  const cells: Array<{ x: number; y: number }> = [];
  let bit = 0;
  for (let x = 0; x < 4; x++) {
    for (let y = 0; y < 7; y++) {
      const on = (bits >>> bit) & 1;
      bit++;
      if (!on) continue;
      cells.push({ x: x + 1, y: y + 1 });
      if (x < 3) cells.push({ x: 7 - x, y: y + 1 });
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 9 9"
      shapeRendering="crispEdges"
      className={className}
      style={{ display: "block", flex: "none", borderRadius: 0 }}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="9" height="9" fill={FRAME} />
      <rect x="1" y="1" width="7" height="7" fill={color} />
      <g fill={PIXEL}>
        {cells.map((cell, index) => (
          <rect key={index} x={cell.x} y={cell.y} width="1" height="1" />
        ))}
      </g>
    </svg>
  );
}
