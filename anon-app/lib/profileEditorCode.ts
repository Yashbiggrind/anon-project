import type { AvatarDesign } from "@/lib/avatarDesign";

const CODE_CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const GRID_MIN = 4;
const GRID_MAX = 32;
const DISPLAY_GRID_SIZE = 7;
const DEFAULT_BACKGROUND = "#0a0306";

export function decodeProfileEditorCode(raw: string): AvatarDesign | null {
  const parts = raw.trim().split("|");
  if (parts.length !== 4 || parts[0] !== "v1") return null;

  const size = Number(parts[1]);
  if (!Number.isInteger(size) || size < GRID_MIN || size > GRID_MAX) return null;

  const encodedCells = parts[3];
  if (encodedCells.length !== size * size) return null;

  const palette = parts[2]
    ? parts[2].split(",").map((hex) => "#" + hex)
    : [];
  if (palette.length > CODE_CHARS.length ||
      palette.some((color) => !/^#[0-9a-fA-F]{6}$/.test(color))) {
    return null;
  }

  const source: Array<string | null> = [];
  for (const char of encodedCells) {
    if (char === ".") {
      source.push(null);
      continue;
    }
    const index = CODE_CHARS.indexOf(char);
    if (index < 0 || !palette[index]) return null;
    source.push(palette[index].toLowerCase());
  }

  // ANON renders a consistent 7×7 profile block everywhere. Resample the
  // editor's 4×4–32×32 image to that display grid without changing the source file.
  const cells = Array.from({ length: DISPLAY_GRID_SIZE * DISPLAY_GRID_SIZE }, (_, index) => {
    const x = index % DISPLAY_GRID_SIZE;
    const y = Math.floor(index / DISPLAY_GRID_SIZE);
    const sx = Math.min(size - 1, Math.floor(((x + 0.5) * size) / DISPLAY_GRID_SIZE));
    const sy = Math.min(size - 1, Math.floor(((y + 0.5) * size) / DISPLAY_GRID_SIZE));
    return source[sy * size + sx];
  });

  return { background: DEFAULT_BACKGROUND, cells };
}

export function encodeAvatarDesignForProfileEditor(design: AvatarDesign | null): string | null {
  if (!design || design.cells.length !== DISPLAY_GRID_SIZE * DISPLAY_GRID_SIZE) return null;

  const palette: string[] = [];
  const cellCodes = design.cells.map((cell) => {
    if (!cell) return ".";
    let index = palette.indexOf(cell.toLowerCase());
    if (index < 0) {
      palette.push(cell.toLowerCase());
      index = palette.length - 1;
    }
    return CODE_CHARS[index] ?? ".";
  });
  return `v1|${DISPLAY_GRID_SIZE}|${palette.map((color) => color.slice(1)).join(",")}|${cellCodes.join("")}`;
}
