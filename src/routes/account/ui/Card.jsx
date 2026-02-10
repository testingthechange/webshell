// src/routes/account/ui/Card.jsx
import React from "react";

export default function Card({ title, children, style }) {
  return (
    <div style={style}>
      <div style={{ fontWeight: 900, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

