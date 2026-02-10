// src/routes/AccountIndex.jsx
// (kept for compatibility; no longer used by App.jsx)
// If you later want /account to redirect to last purchase, wire this back in intentionally.
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const COLLECTION_KEY = "bb_collection_v1";

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function safeString(v) {
  return String(v ?? "").trim();
}

function loadIds() {
  const raw = localStorage.getItem(COLLECTION_KEY);
  const parsed = raw ? safeParse(raw) : null;
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((x) => (typeof x === "string" ? x : x?.shareId))
    .map((x) => safeString(x))
    .filter(Boolean);
}

export default function AccountIndex() {
  const nav = useNavigate();

  useEffect(() => {
    const ids = loadIds();
    if (ids[0]) nav(`/account/${ids[0]}`, { replace: true });
    else nav("/shop", { replace: true });
  }, [nav]);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <div style={{ fontSize: 18, fontWeight: 900 }}>Loading account…</div>
    </div>
  );
}
