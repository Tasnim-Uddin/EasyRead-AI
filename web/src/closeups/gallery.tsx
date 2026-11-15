// Dev gallery for reviewing the close-up library (demo mode only): #/closeups shows every close-up playing;
// #/closeups/<id> shows one in a phone-sized step layout, like Figma 06a/07a.
import React, { useState } from "react";
import { CloseUp, CLOSEUP_IDS } from "./index";

const page: React.CSSProperties = { background: "#FFF6EA", minHeight: "100vh", padding: 16, fontFamily: "Atkinson Hyperlegible, sans-serif", color: "#3A2A20" };

export default function CloseUpGallery({ only }: { only?: string }) {
  const [playing, setPlaying] = useState(true);
  if (only) {
    return (
      <div style={{ ...page, maxWidth: 390, margin: "0 auto", paddingTop: 126 }}>
        <div style={{ width: "100%", aspectRatio: "358 / 380", borderRadius: 28, overflow: "hidden" }}>
          <CloseUp id={only} playing={playing} />
        </div>
        <p style={{ fontFamily: "Fredoka, sans-serif", fontSize: 26, fontWeight: 600, margin: "14px 0 0" }}>{only}</p>
        <button className="btn" style={{ marginTop: 16 }} onClick={() => setPlaying((p) => !p)}>{playing ? "Pause" : "Play"}</button>
      </div>
    );
  }
  return (
    <div style={page}>
      <h1 style={{ fontFamily: "Fredoka, sans-serif", margin: "0 0 12px" }}>Close-ups ({CLOSEUP_IDS.length})</h1>
      <button className="btn" style={{ marginBottom: 16, maxWidth: 200 }} onClick={() => setPlaying((p) => !p)}>{playing ? "Pause all" : "Play all"}</button>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
        {CLOSEUP_IDS.map((id) => (
          <a key={id} href={`#/closeups/${id}`} style={{ color: "inherit", textDecoration: "none" }}>
            <div style={{ aspectRatio: "358 / 380", borderRadius: 18, overflow: "hidden" }}>
              <CloseUp id={id} playing={playing} />
            </div>
            <div style={{ fontSize: 14, marginTop: 4, overflowWrap: "anywhere" }}>{id}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
