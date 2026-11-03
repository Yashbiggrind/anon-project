import type { AvatarDesign } from "@/lib/avatarDesign";
import {
  AVATAR_MAX_GRID_SIZE,
  AVATAR_MIN_GRID_SIZE,
  AVATAR_GRID_SIZE,
  sanitizeAvatarDesign,
} from "@/lib/avatarDesign";

const CODE_CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DEFAULT_BACKGROUND = "#0a0306";

export function decodeProfileEditorCode(raw: string): AvatarDesign | null {
  const parts = raw.trim().split("|");
  if (parts.length !== 4 || parts[0] !== "v1") return null;

  const gridSize = Number(parts[1]);
  if (
    !Number.isInteger(gridSize) ||
    gridSize < AVATAR_MIN_GRID_SIZE ||
    gridSize > AVATAR_MAX_GRID_SIZE
  ) return null;

  const encodedCells = parts[3];
  if (encodedCells.length !== gridSize * gridSize) return null;

  const palette = parts[2]
    ? parts[2].split(",").map((hex) => "#" + hex)
    : [];
  if (palette.length > CODE_CHARS.length ||
      palette.some((color) => !/^#[0-9a-fA-F]{6}$/.test(color))) {
    return null;
  }

  const cells: Array<string | null> = [];
  for (const char of encodedCells) {
    if (char === ".") {
      cells.push(null);
      continue;
    }
    const index = CODE_CHARS.indexOf(char);
    if (index < 0 || !palette[index]) return null;
    cells.push(palette[index].toLowerCase());
  }

  // Keep every source pixel. Earlier versions resampled 4×4–32×32 designs
  // to 7×7 here, permanently losing detail before saving or syncing.
  return sanitizeAvatarDesign({
    background: DEFAULT_BACKGROUND,
    gridSize,
    cells,
  });
}

export function encodeAvatarDesignForProfileEditor(design: AvatarDesign | null): string | null {
  if (!design) return null;
  const safe = sanitizeAvatarDesign(design);
  if (!safe) return null;

  const palette: string[] = [];
  const cellCodes = safe.cells.map((cell) => {
    if (!cell) return ".";
    let index = palette.indexOf(cell.toLowerCase());
    if (index < 0) {
      palette.push(cell.toLowerCase());
      index = palette.length - 1;
    }
    return CODE_CHARS[index] ?? ".";
  });
  return `v1|${safe.gridSize}|${palette.map((color) => color.slice(1)).join(",")}|${cellCodes.join("")}`;
}
