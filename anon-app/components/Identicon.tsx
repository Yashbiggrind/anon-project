"use client";

import { useSyncExternalStore } from "react";
import {
  AVATAR_PALETTE,
  type AvatarDesign,
  getAvatarDesign,
  subscribeAvatarDesign,
} from "@/lib/avatarDesign";

type Props = {
  name: string;
  seed?: string;
  size?: number;
  className?: string;
  /** Pass a draft while editing; normal avatars read the live session design store. */
  design?: AvatarDesign | null;
};

function fnv1a(str: string, seed = 2166136261): number {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

const PALETTE = AVATAR_PALETTE.slice(0, 16);
const FRAME = "#17070d";
const PIXEL = "#10070b";
const MOB_PATTERNS = [
  [".......", ".##.##.", ".##.##.", "...#...", "..###..", "...#...", "...#..."], // creeper-like face
  [".......", ".#...#.", ".#...#.", ".......", "..###..", "...#...", "......."], // slime
  [".......", ".......", "##...##", ".......", "...#...", "...#...", "...#..."], // ender
  [".#####.", "#.....#", "#.#.#.#", "#.....#", ".#...#.", "..###..", "...#..."], // skeleton
  ["#.....#", "##...##", ".......", "...#...", "..###..", "...#...", "......."], // axolotl
  [".#...#.", ".......", "...#...", "..###..", "..###..", "...#...", "...#..."], // chicken
  ["#.#.#.#", ".#####.", "#.#.#.#", ".......", "..###..", "...#...", "...#..."], // bee
  ["##...##", "#######", ".#...#.", ".......", "..###..", "...#...", "...#..."], // wolf
] as const;

export default function Identicon({
  name,
  seed,
  size = 32,
  className = "",
  design,
}: Props) {
  const identity = (seed?.trim() || name.trim() || "anon").normalize("NFKC");
  const liveDesign = useSyncExternalStore(
    subscribeAvatarDesign,
    () => getAvatarDesign(identity),
    () => undefined,
  );
  // A cached live profile is authoritative; the message snapshot is a fallback
  // for messages received before this profile was seen online.
  const activeDesign = liveDesign !== undefined ? liveDesign : (design ?? null);
  const gridSize = activeDesign?.gridSize ?? 7;
  const color = PALETTE[fnv1a(identity + "#color") % PALETTE.length];
  const accent = PALETTE[fnv1a(identity + "#accent") % PALETTE.length];
  const pattern = MOB_PATTERNS[fnv1a(identity + "#mob-face") % MOB_PATTERNS.length];

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${gridSize + 2} ${gridSize + 2}`}
      shapeRendering="crispEdges"
      className={className}
      style={{ display: "block", flex: "none", borderRadius: 0 }}
      aria-hidden="true"
      focusable="false"
    >
      <rect width={gridSize + 2} height={gridSize + 2} fill={FRAME} />
      <rect x="1" y="1" width={gridSize} height={gridSize} fill={activeDesign?.background ?? color} />
      {activeDesign ? (
        <g>
          {activeDesign.cells.map((cell, index) => cell ? (
            <rect
              key={index}
              x={(index % gridSize) + 1}
              y={Math.floor(index / gridSize) + 1}
              width="1"
              height="1"
              fill={cell}
            />
          ) : null)}
        </g>
      ) : (
        <g>
          {pattern.map((row, y) => row.split("").map((cell, x) => {
            if (cell === ".") return null;
            return (
              <rect
                key={`${x}-${y}`}
                x={x + 1}
                y={y + 1}
                width="1"
                height="1"
                fill={cell === "+" ? accent : PIXEL}
              />
            );
          }))}
        </g>
      )}
    </svg>
  );
}
