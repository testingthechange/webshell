/* ======================================================================
   FILE: src/routes/Shop.jsx
   PURPOSE:
   - Local Published Queue for Shop
   - Paste shareId → loads publish/:shareId.json
   - Renders album rows WITH COVER IMAGE
   - Click row → /product/:shareId
   ====================================================================== */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import loadManifest from "../lib/loadManifest.js";

const QUEUE_KEY = "bb_published_queue_v1";

const API_BASE =
  String(import.meta?.env?.VITE_API_BASE || "").trim().replace(/\/+$/, "") ||
  "https://album-backend-kmuo.onrender.com";

/* ---------------- utils ---------------- */

function safeParse(v) {
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

function safe(v) {
  return String(v ?? "").trim();
}

function readQueue() {
  const raw = localStorage.getItem(QUEUE_KEY);
  const arr = safeParse(raw || "[]");
  return Array.isArray(arr) ? arr : [];
}

function writeQueue(rows) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(rows));
}

async function signCover(s3Key) {
  if (!s3Key) return "";
  const r = await fetch(
    `${API_BASE}/api/playback-url?s3Key=${encodeURIComponent(s3Key)}`,
    { cache: "no-store" }
  );
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.ok) return "";
  return j.url || j.playbackUrl || "";
}

/* ---------------- component ---------------- */

export default function Shop() {
  const nav = useNavigate();

  const [queue, setQueue] = useState(() => readQueue());
  const [covers, setCovers] = useState({});
  const [shareId, setShareId] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  /* sign covers */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      for (const r of queue) {
        if (!r.coverS3Key) continue;
        if (covers[r.shareId]) continue;

        const url = await signCover(r.coverS3Key);
        if (url && !cancelled) {
          setCovers((p) => ({ ...p, [r.shareId]: url }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [queue, covers]);

  async function addShare() {
    const id = safe(shareId);
    if (!id) return;

    setBusy(true);
    setErr("");

    try {
      const m = await loadManifest(id);

      const entry = {
        shareId: id,
        title: m.title || "Album",
        artist: m.artist || "",
        coverS3Key: m.coverS3Key || "",
        addedAt: new Date().toISOString(),
      };

      const next = [entry, ...queue.filter((r) => r.shareId !== id)];

      setQueue(next);
      writeQueue(next);
      setShareId("");

      if (entry.coverS3Key) {
        const url = await signCover(entry.coverS3Key);
        if (url) setCovers((p) => ({ ...p, [id]: url }));
      }
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 32 }}>
      <h2 style={{ letterSpacing: 2 }}>PUBLISHED QUEUE (LOCAL)</h2>

      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        <input
          value={shareId}
          onChange={(e) => setShareId(e.target.value)}
          placeholder="Paste shareId from Publish result…"
          style={styles.input}
          onKeyDown={(e) => e.key === "Enter" && addShare()}
        />
        <button onClick={addShare} disabled={busy} style={styles.btn}>
          {busy ? "Adding…" : "Add"}
        </button>
      </div>

      {err && <div style={{ marginTop: 10, color: "salmon" }}>{err}</div>}

      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 14 }}>
        {queue.map((r) => (
          <button
            key={r.shareId}
            onClick={() => nav(`/product/${r.shareId}`)}
            style={styles.row}
          >
            <div style={styles.thumb}>
              {covers[r.shareId] ? (
                <img
                  src={covers[r.shareId]}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              ) : (
                <div style={styles.placeholder}>COVER</div>
              )}
            </div>

            <div style={{ textAlign: "left" }}>
              <div style={{ fontWeight: 900 }}>{r.title}</div>
              <div style={{ opacity: 0.7 }}>{r.artist}</div>
              <div style={{ opacity: 0.5, fontFamily: "monospace" }}>{r.shareId}</div>
            </div>
          </button>
        ))}

        {!queue.length && <div style={{ opacity: 0.6 }}>No published albums yet.</div>}
      </div>
    </div>
  );
}

/* ---------------- styles ---------------- */

const styles = {
  input: {
    flex: 1,
    padding: "14px 16px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.05)",
    color: "#fff",
    fontFamily: "monospace",
  },
  btn: {
    padding: "14px 18px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.1)",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },
  row: {
    display: "flex",
    gap: 16,
    padding: 16,
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    cursor: "pointer",
    color: "#fff",
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 18,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.05)",
    flex: "0 0 auto",
  },
  placeholder: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    opacity: 0.6,
    letterSpacing: 2,
  },
};
