import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { loadManifest } from "../lib/loadManifest.js";

export default function Product({ onPlayTrack, currentTrack }) {
  const { shareId } = useParams();
  const [album, setAlbum] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    setAlbum(null);
    setErr("");

    if (!shareId) {
      setErr("MISSING_SHARE_ID");
      return;
    }

    loadManifest(shareId)
      .then((data) => {
        if (!alive) return;
        setAlbum(data);
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
    <div className="layout-60-40">
      {/* LEFT COLUMN */}
      <div className="layout-left">
        <div className="cover-art">
          {album?.coverUrl ? (
            <img src={album.coverUrl} alt="Album cover" />
          ) : (
            <div className="cover-art-placeholder">No Cover</div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN */}
      <div className="layout-right">
        {/* ALBUM INFO CARD */}
        <div className="card album-info">
          <div className="album-name">{album?.title || "Untitled Album"}</div>
          <div className="album-performer">{album?.artist || ""}</div>
        </div>

        {/* BUY BUTTON CARD */}
        <div className="card">
          <button className="buy-button">
            Buy Album
          </button>
        </div>

        {/* MARKETING CARD */}
        <div className="card marketing-info">
          <h4>What you get</h4>
          <ul>
            <li>Full-quality album playback</li>
            <li>Permanent access</li>
            <li>Future updates included</li>
          </ul>
        </div>

        {/* TRACK LIST CARD */}
        <div className="card">
          <div className="card-header">Track List</div>
          <div className="track-list">
            {tracks.map((t, i) => {
              const isActive = currentTrack?.id === t.id;
              return (
                <div
                  key={t.id || i}
                  className={`track-item ${isActive ? "active" : ""}`}
                  onClick={() => onPlayTrack && onPlayTrack(t)}
                >
                  <div className="track-number">{i + 1}</div>
                  <div className="track-name">{t.title}</div>
                </div>
              );
            })}
          </div>
        </div>

        {err && (
          <div className="card" style={{ color: "#ff6b6b" }}>
            Error: {err}
          </div>
        )}
      </div>
    </div>
  );
}
