import React from "react";

export default function MiniNav({ openTab, onToggleTab, children }) {
  return (
    <div style={styles.shell}>
      <div style={styles.tabsRow}>
        <Tab label="My Collection" active={openTab === "collection"} onClick={() => onToggleTab("collection")} />
        <Tab label="Playlists" active={openTab === "playlist"} onClick={() => onToggleTab("playlist")} />
        <Tab label="Swag" active={openTab === "swag"} onClick={() => onToggleTab("swag")} />
        <Tab label="Settings" active={openTab === "settings"} onClick={() => onToggleTab("settings")} />
      </div>

      {openTab ? <div style={styles.dropdown}>{children}</div> : null}
    </div>
  );
}

function Tab({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...styles.tabBtn,
        background: active ? "rgba(255,255,255,0.12)" : "transparent",
        borderColor: active ? "rgba(255,255,255,0.30)" : "rgba(255,255,255,0.12)",
      }}
    >
      {label}
    </button>
  );
}

const styles = {
  shell: {
    padding: 14,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
  },
  tabsRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  tabBtn: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "transparent",
    color: "rgba(255,255,255,0.92)",
    fontWeight: 900,
    cursor: "pointer",
    textAlign: "left",
  },
  dropdown: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.20)",
  },
};
