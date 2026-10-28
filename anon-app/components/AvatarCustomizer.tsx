"use client";

import { useEffect, useRef, useState } from "react";
import Identicon from "@/components/Identicon";
import {
  AVATAR_GRID_SIZE,
  AVATAR_PALETTE,
  type AvatarDesign,
} from "@/lib/avatarDesign";

type Props = {
  name: string;
  initialDesign: AvatarDesign | null;
  onSave: (design: AvatarDesign | null) => void;
  onClose: () => void;
};

const VOID = "#17070d";
const DARK = "#10070b";
const CREEPER = [
  ".......", ".##.##.", ".##.##.", "...#...", "..###..", "...#...", "...#...",
];
const SLIME = [
  ".......", ".#...#.", ".#...#.", ".......", "..###..", "...#...", ".......",
];
const ENDER = [
  ".......", ".......", "##...##", ".......", "...#...", "...#...", "...#...",
];
const T_BLOCK = [
  "..###..", "...#...", "...#...", ".......", ".......", ".......", ".......",
];
const L_BLOCK = [
  "..#....", "..#....", "..#....", "..###..", ".......", ".......", ".......",
];
const Z_BLOCK = [
  ".......", ".###...", "...###.", ".......", ".......", ".......", ".......",
];

function fromRows(rows: string[], background: string, ink: string): AvatarDesign {
  return {
    background,
    cells: rows.join("").split("").map((char) => char === "#" ? ink : null),
  };
}

function starter(name: string): AvatarDesign {
  const h = Array.from(name).reduce((value, char) => ((value * 33) ^ char.charCodeAt(0)) >>> 0, 5381);
  const options = [
    fromRows(CREEPER, "#9aef61", DARK),
    fromRows(SLIME, "#53e2b7", DARK),
    fromRows(ENDER, "#b9a0ff", "#10070b"),
  ];
  return options[h % options.length];
}

export default function AvatarCustomizer({ name, initialDesign, onSave, onClose }: Props) {
  const [design, setDesign] = useState<AvatarDesign>(() => initialDesign
    ? { background: initialDesign.background, cells: [...initialDesign.cells] }
    : starter(name));
  const [tool, setTool] = useState<"paint" | "erase">("paint");
  const [ink, setInk] = useState<string>("#ff4f7f");
  const drawing = useRef(false);

  useEffect(() => {
    const stopDrawing = () => { drawing.current = false; };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("pointerup", stopDrawing);
    window.addEventListener("pointercancel", stopDrawing);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerup", stopDrawing);
      window.removeEventListener("pointercancel", stopDrawing);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const paintCell = (index: number) => {
    setDesign((previous) => {
      const cells = [...previous.cells];
      cells[index] = tool === "erase" ? null : ink;
      return { ...previous, cells };
    });
  };

  const applyPreset = (key: string) => {
    const presets: Record<string, AvatarDesign> = {
      creeper: fromRows(CREEPER, "#9aef61", DARK),
      slime: fromRows(SLIME, "#53e2b7", DARK),
      ender: fromRows(ENDER, "#b9a0ff", "#ff91cd"),
      t: fromRows(T_BLOCK, VOID, "#56d8ff"),
      l: fromRows(L_BLOCK, VOID, "#ffb84d"),
      z: fromRows(Z_BLOCK, VOID, "#ff4f7f"),
    };
    setDesign(presets[key] ?? starter(name));
    if (key === "t") setInk("#56d8ff");
    if (key === "l") setInk("#ffb84d");
    if (key === "z") setInk("#ff4f7f");
  };

  const randomize = () => {
    const bright = AVATAR_PALETTE.filter((color) => color !== VOID && color !== DARK);
    const background = bright[Math.floor(Math.random() * bright.length)];
    const accent = bright[Math.floor(Math.random() * bright.length)];
    const cells = Array.from({ length: AVATAR_GRID_SIZE * AVATAR_GRID_SIZE }, () =>
      Math.random() > 0.52 ? accent : null);
    setDesign({ background, cells });
    setInk(accent);
  };

  return (
    <div className="avatarStudioBackdrop" onClick={onClose}>
      <section
        className="avatarStudio"
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatarStudioTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="avatarStudioTop">
          <div>
            <div className="avatarStudioEyebrow">ANON / PIXEL WORKSHOP</div>
            <h2 id="avatarStudioTitle">Build your block avatar</h2>
            <p>One grid. Your colors. No image uploads. Session-only.</p>
          </div>
          <button type="button" className="avatarStudioClose" aria-label="Close avatar editor" onClick={onClose}>×</button>
        </div>

        <div className="avatarStudioWorkspace">
          <div className="avatarStudioPreview">
            <Identicon name={name} seed="avatar-studio-preview" size={112} design={design} />
            <span>LIVE PREVIEW</span>
            <strong>{name}</strong>
            <small>7 × 7 pixel blocks</small>
          </div>

          <div className="avatarStudioEditor">
            <div className="avatarStudioLabel">BLOCK CANVAS <span>CLICK OR DRAG TO EDIT</span></div>
            <div className="avatarBlockGrid" role="group" aria-label="Avatar pixel grid">
              {design.cells.map((cell, index) => (
                <button
                  type="button"
                  key={index}
                  className="avatarBlockCell"
                  aria-label={cell ? `Erase or recolor block ${index + 1}` : `Add block ${index + 1}`}
                  style={{ backgroundColor: cell ?? design.background }}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    drawing.current = true;
                    paintCell(index);
                  }}
                  onPointerEnter={() => { if (drawing.current) paintCell(index); }}
                />
              ))}
            </div>
            <div className="avatarStudioTools">
              <button type="button" className={tool === "paint" ? "selected" : ""} onClick={() => setTool("paint")}>▦ Paint blocks</button>
              <button type="button" className={tool === "erase" ? "selected" : ""} onClick={() => setTool("erase")}>⌫ Erase blocks</button>
              <button type="button" onClick={() => setDesign((previous) => ({ ...previous, cells: Array(49).fill(null) }))}>Clear canvas</button>
              <button type="button" onClick={randomize}>Randomize</button>
            </div>

            <div className="avatarStudioPaletteGroup">
              <div className="avatarStudioLabel">BLOCK COLOUR</div>
              <div className="avatarStudioPalette">
                {AVATAR_PALETTE.filter((color) => color !== VOID && color !== DARK).map((color) => (
                  <button
                    key={color}
                    type="button"
                    title={color}
                    aria-label={`Select block colour ${color}`}
                    className={ink === color ? "active" : ""}
                    style={{ backgroundColor: color }}
                    onClick={() => { setInk(color); setTool("paint"); }}
                  />
                ))}
              </div>
            </div>

            <div className="avatarStudioPaletteGroup">
              <div className="avatarStudioLabel">BASE COLOUR <span>EMPTY BLOCKS</span></div>
              <div className="avatarStudioPalette">
                {AVATAR_PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    title={color}
                    aria-label={`Select base colour ${color}`}
                    className={design.background === color ? "active" : ""}
                    style={{ backgroundColor: color }}
                    onClick={() => setDesign((previous) => ({ ...previous, background: color }))}
                  />
                ))}
              </div>
            </div>

            <div className="avatarStudioLabel">QUICK SHAPES <span>MOB-INSPIRED / TETRIS-STYLE</span></div>
            <div className="avatarStudioPresets">
              <button type="button" onClick={() => applyPreset("creeper")}><span className="presetMark creeperMark">▦</span>Creeper</button>
              <button type="button" onClick={() => applyPreset("slime")}><span className="presetMark slimeMark">■</span>Slime</button>
              <button type="button" onClick={() => applyPreset("ender")}><span className="presetMark enderMark">◆</span>Ender</button>
              <button type="button" onClick={() => applyPreset("t")}><span className="presetMark tMark">T</span>T block</button>
              <button type="button" onClick={() => applyPreset("l")}><span className="presetMark lMark">L</span>L block</button>
              <button type="button" onClick={() => applyPreset("z")}><span className="presetMark zMark">Z</span>Z block</button>
            </div>
          </div>
        </div>

        <div className="avatarStudioFooter">
          <button type="button" className="avatarStudioReset" onClick={() => onSave(null)}>Use generated avatar</button>
          <div>
            <button type="button" className="avatarStudioCancel" onClick={onClose}>Cancel</button>
            <button type="button" className="avatarStudioSave" onClick={() => onSave(design)}>Save avatar</button>
          </div>
        </div>
      </section>
    </div>
  );
}
