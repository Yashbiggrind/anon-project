"use client";

/**
 * Identicon — GitHub-style pixel avatar.
 *
 * 5x5 mirrored grid. Sparse patterns. Solid bright colors on dark bg.
 * Matches the reference design exactly.
 *
 * Uniqueness: 2^15 patterns x 12 colors = ~393k combos.
 * For higher collision resistance we mix two hashes for the bit pattern.
 */

type Props = {
  name: string;
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

// 12 bright solid colors — no gradients, punchy, readable on dark
const PALETTE = [
  "#ff2d55", // red
  "#ff8a5b", // orange
  "#ffd166", // yellow
  "#8ee06e", // green
  "#7dd3fc", // sky
  "#a78bfa", // violet
  "#f472b6", // pink
  "#fb7185", // rose
  "#fbbf24", // amber
  "#4ade80", // emerald
  "#38bdf8", // cyan
  "#c084fc", // purple
];

export default function Identicon({ name, size = 32, className = "" }: Props) {
  const colorSeed = fnv1a(name);
  const color = PALETTE[colorSeed % PALETTE.length];

  // Bits come from a mixed hash so patterns feel less correlated to color
  const bits = fnv1a(name + "#grid") ^ fnv1a(name, 5381);

  // 5x5 grid, mirror columns 0-1 to columns 4-3. Column 2 is center.
  // We only decide the left 3 columns (15 bits total).
  const cells: { x: number; y: number }[] = [];
  let bit = 0;
  for (let x = 0; x < 3; x++) {
    for (let y = 0; y < 5; y++) {
      const on = (bits >> bit) & 1;
      bit++;
      if (on) {
        cells.push({ x, y });
        if (x < 2) cells.push({ x: 4 - x, y });
      }
    }
  }

  // Guarantee a visible pattern — never fully blank
  if (cells.length < 4) {
    cells.length = 0;
    cells.push(
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 2, y: 3 },
      { x: 1, y: 2 },
      { x: 3, y: 2 }
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 5 5"
      shapeRendering="crispEdges"
      className={className}
      aria-hidden="true"
    >
      <rect width="5" height="5" fill="#160409" />
      <g fill={color}>
        {cells.map((c, i) => (
          <rect key={i} x={c.x} y={c.y} width="1" height="1" />
        ))}
      </g>
    </svg>
  );
}