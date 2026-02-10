// FILE: src/components/account/useAccountPlaybackMode.js
// PURPOSE: Account-only playback mode + Smart Bridge selection state.
// NOTES:
// - No fetching / no manifest loading.
// - Pure UI state + optional localStorage persistence (safe; no content loads).

import { useEffect, useMemo, useState } from "react";

function safeId(v) {
  return String(v ?? "").trim();
}

function storageKey(shareId) {
  const id = safeId(shareId);
  return id ? `accountPlaybackMode::${id}` : `accountPlaybackMode::unknown`;
}

export function useAccountPlaybackMode({ shareId } = {}) {
  const key = useMemo(() => storageKey(shareId), [shareId]);

  // mode: "album" | "smartBridge"
  const [mode, setMode] = useState("album");

  // Smart Bridge skeleton selections (A/B for now)
  const [sbA, setSbA] = useState(0);
  const [sbB, setSbB] = useState(1);

  // restore
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const j = JSON.parse(raw);
      if (j?.mode === "album" || j?.mode === "smartBridge") setMode(j.mode);
      if (Number.isFinite(j?.sbA)) setSbA(j.sbA);
      if (Number.isFinite(j?.sbB)) setSbB(j.sbB);
    } catch {
      // ignore
    }
  }, [key]);

  // persist
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify({ mode, sbA, sbB }));
    } catch {
      // ignore
    }
  }, [key, mode, sbA, sbB]);

  const smartBridge = {
    sbA,
    sbB,
    setSbA,
    setSbB,
  };

  return { mode, setMode, smartBridge };
}
