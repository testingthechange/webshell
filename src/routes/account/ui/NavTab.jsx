// src/routes/account/ui/NavTab.jsx
import React from "react";

export default function NavTab({ label, active, onClick, style }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...style,
        background: active ? "rgba(255,255,255,0.12)" : "transparent",
        borderColor: active ? "rgba(255,255,255,0.30)" : "rgba(255,255,255,0.12)",
      }}
    >
      {label}
    </button>
  );
}
