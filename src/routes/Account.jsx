import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { loadManifest } from "../lib/loadManifest.js";
import AccountPlayer from "../components/AccountPlayer.jsx";

export default function Account() {
  const { shareId } = useParams();
  const [album, setAlbum] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    setErr("");
    setAlbum(null);

    loadManifest(shareId)
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

      <h1>Account</h1>
      <div style={{ opacity: 0.75, marginBottom: 12 }}>key: {shareId}</div>

      {err ? <div style={{ color: "#b00020", marginBottom: 12 }}>Error: {err}</div> : null}
      {!album ? <div style={{ opacity: 0.75 }}>Loading…</div> : null}

      {album ? (
        <>
          {tracks.length === 0 ? (
            <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
              No tracks in manifest.
            </div>
          ) : null}

          <div className="panel">
            <div className="title">{album.title || "Untitled"}</div>
            <div className="sub">{album.artist || ""}</div>
            <AccountPlayer tracks={tracks} />
          </div>
        </>
      ) : null}
    </div>
  );
}
