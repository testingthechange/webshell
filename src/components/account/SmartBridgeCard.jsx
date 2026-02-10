// FILE: src/components/account/SmartBridgeCard.jsx
// Account-only Adaptive Album UI card (no player logic, no routing, no A/B)

export default function SmartBridgeCard({
  tracks = [],              // catalog songs: [{ slot, title, ... }]
  nowPlayingLabel = "",     // string shown under Now Playing
  activeSlot = null,        // number | null (which song is "active")
  highlightVisible = false, // boolean (turns off after 100s in parent)
}) {
  const list = Array.isArray(tracks) ? tracks : [];

  const rows = list
    .map((s) => ({
      slot: Number(s?.slot),
      title: String(s?.title || "").trim(),
    }))
    .filter((s) => Number.isFinite(s.slot) && s.slot > 0 && s.title)
    .sort((a, b) => a.slot - b.slot);

  return (
    <div style={wrap}>
      <div style={head}>
        <div style={{ fontWeight: 900 }}>Adaptive Album</div>
      </div>

      <div style={np}>
        <div style={{ opacity: 0.7, fontSize: 12, fontWeight: 800 }}>Now Playing</div>
        <div style={{ marginTop: 4, fontWeight: 900 }}>{nowPlayingLabel || "—"}</div>
      </div>

      <div style={{ marginTop: 12 }}>
        {rows.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rows.map((s) => {
              const isActive = highlightVisible && activeSlot === s.slot;
              return (
                <div
                  key={`sb-${s.slot}`}
                  style={{
                    ...row,
                    background: isActive ? "rgba(255,255,255,0.10)" : "transparent",
                    borderColor: isActive ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.12)",
                    transition: "opacity 2.5s ease, background 0.25s ease, border-color 0.25s ease",
                    opacity: isActive ? 1 : 0.9,
                  }}
                >
                  <span style={{ opacity: 0.7, marginRight: 8 }}>{s.slot}.</span>
                  {s.title}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ opacity: 0.75 }}>No songs.</div>
        )}
      </div>
    </div>
  );
}

const wrap = {
  padding: 14,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.05)",
};

const head = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const np = {
  marginTop: 10,
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(0,0,0,0.16)",
};

const row = {
  textAlign: "left",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  color: "#fff",
};
