import React from "react";

function safeString(v) {
  return String(v ?? "").trim();
}

export default function CollectionDropdown({ thumbIds = [], cards = {}, activeId = "", onOpenAlbum }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 10, opacity: 0.9 }}>Collection</div>

      {!thumbIds.length ? (
        <div style={{ opacity: 0.7 }}>No purchases yet.</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {thumbIds.map((id) => {
            const c = cards[id] || {};
            const selected = id === activeId;

            return (
              <button
                key={id}
                type="button"
                onClick={() => onOpenAlbum?.(id)}
                style={{
                  ...styles.row,
                  background: selected ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.04)",
                  borderColor: selected ? "rgba(255,255,255,0.30)" : "rgba(255,255,255,0.12)",
                }}
              >
                <div style={styles.thumb}>
                  {c?.coverUrl ? (
                    <img
                      src={c.coverUrl}
                      alt="cover"
                      style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10, display: "block" }}
                    />
                  ) : (
                    <div style={{ opacity: 0.6, fontSize: 10 }}>COVER</div>
                  )}
                </div>

                <div style={{ textAlign: "left", flex: 1 }}>
                  <div style={{ fontWeight: 900, fontSize: 13 }}>
                    {safeString(c?.artist) || "—"} — {safeString(c?.title) || "Untitled"}
                  </div>
                </div>

                <div style={{ opacity: 0.7, fontSize: 12 }}>Open</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  row: {
    width: "100%",
    display: "flex",
    gap: 10,
    alignItems: "center",
    padding: 10,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
};
