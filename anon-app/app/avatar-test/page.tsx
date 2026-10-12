"use client";

import Identicon from "@/components/Identicon";

const NAMES = [
  "MidnightWolf558", "AshenFox908", "SilentWolf482", "NeonMoth214",
  "VelvetCrow337", "GhostLynx552", "HollowOwl671", "StaticViper120",
  "LunarHeron845", "QuietCobra403", "CrimsonBat266", "MidnightFox119",
  "NeonRaven777", "ShadowMoth333", "IronWolf661", "LostHeron202",
  "you", "alex", "priya", "arjun", "sara", "kabir", "riya", "dev",
];

export default function AvatarTest() {
  return (
    <div style={{ padding: "40px", background: "#040203", color: "#e8dde2", fontFamily: "monospace", minHeight: "100vh" }}>
      <h1 style={{ color: "#ff2d55", fontFamily: "'Bodoni Moda', serif", fontSize: "32px" }}>Identicon Gallery</h1>
      <p style={{ color: "#8a7276", fontSize: "12px" }}>Every username maps to a unique pixel avatar. Same name always same avatar.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "16px", marginTop: "32px" }}>
        {NAMES.map((n) => (
          <div key={n} style={{ padding: "16px", background: "#0a0407", border: "1px solid #2a0a12", borderRadius: "8px", textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "10px" }}>
              <Identicon name={n} size={64} />
            </div>
            <div style={{ color: "#c9a3ad", fontSize: "12px", wordBreak: "break-all" }}>{n}</div>
          </div>
        ))}
      </div>

      <h2 style={{ color: "#ff2d55", fontFamily: "'Bodoni Moda', serif", fontSize: "24px", marginTop: "48px" }}>Same name, three sizes</h2>
      <div style={{ display: "flex", gap: "24px", alignItems: "center", marginTop: "16px" }}>
        <Identicon name="MidnightWolf558" size={24} />
        <Identicon name="MidnightWolf558" size={40} />
        <Identicon name="MidnightWolf558" size={72} />
      </div>
    </div>
  );
}