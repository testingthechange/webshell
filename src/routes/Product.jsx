import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { loadManifest } from "../lib/loadManifest.js";

export default function Product({ onPlayTrack, currentTrack }) {
  const { shareId } = useParams(); // MUST match App.jsx: /product/:shareId
  const [album, setAlbum] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    setErr("");
    setAlbum(null);

    const key = (shareId || "").trim();
    if (!key) {
      setErr("MISSING_PROJECT_KEY");
      return () => {
        alive = false;
      };
    }

    loadManifest(key)
      .then((a) => {
        if (!alive) return;
        setAlbum(a);
      })
      .catch((e) => {
        if (!alive) return;
        setErr(String(e?.message || e));
      });

    return () => {
      alive = false;
    };
  }, [shareId]);

  const tracks = album?.tracks || [];

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Link to="/shop">← Back to Shop</Link>
      </div>

      <h1>Product</h1>
      <div style={{ opacity: 0.75, marginBottom: 12 }}>shareId: {shareId}</div>

      {err ? (
        <div style={{ color: "#b00020", marginBottom: 12 }}>Error: {err}</div>
      ) : null}
      {!album && !err ? <div style={{ opacity: 0.75 }}>Loading…</div> : null}

      {album ? (
        <>
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{album.title || "Untitled"}</div>
            <div style={{ opacity: 0.8, marginTop: 4 }}>{album.artist || ""}</div>
          </div>

          <div style={{ marginTop: 18 }}>
            <h2>Tracks</h2>
            <ol style={{ marginTop: 10 }}>
              {tracks.map((t, i) => {
                const isActive =
                  currentTrack &&
                  (String(currentTrack.id) === String(t.id) ||
                    String(currentTrack.s3Key || "") === String(t.s3Key || ""));

                return (
                  <li key={t.id || i} style={{ marginBottom: 10 }}>
                    <button
                      onClick={() => onPlayTrack && onPlayTrack(t)}
                      style={{
                        cursor: "pointer",
                        background: "transparent",
                        border: "1px solid rgba(255,255,255,0.15)",
                        padding: "10px 12px",
                        borderRadius: 10,
                        color: "inherit",
                        width: "100%",
                        textAlign: "left",
                        opacity: isActive ? 1 : 0.9,
                      }}
                    >
                      {t.title || `Track ${i + 1}`}
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </>
      ) : null}
    </div>
  );
}
