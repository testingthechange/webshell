// src/routes/account/ui/styles.js
export const cardStyle = {
  padding: 16,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
};

export const coverBox = {
  width: "100%",
  aspectRatio: "1 / 1",
  borderRadius: 24,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
};

export const errorBox = {
  marginTop: 14,
  padding: 12,
  borderRadius: 14,
  border: "1px solid rgba(255,80,80,0.35)",
  background: "rgba(255,80,80,0.08)",
  color: "rgba(255,255,255,0.92)",
};

export const navShell = {
  padding: 14,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
};

export const navTabsRow = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

export const navTabBtn = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "transparent",
  color: "rgba(255,255,255,0.92)",
  fontWeight: 900,
  cursor: "pointer",
  textAlign: "left",
};

export const navDropdown = {
  marginTop: 12,
  padding: 12,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.20)",
};

export const dropdownRow = {
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
};

export const miniThumb = {
  width: 44,
  height: 44,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};
