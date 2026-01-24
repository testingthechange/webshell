import { useEffect, useState } from "react";
import { useParams, Link, NavLink } from "react-router-dom";
import { loadManifest } from "../lib/loadManifest.js";

export default function Product({ onPlayTrack, currentTrack }) {
  const { shareId } = useParams(); // /product/:shareId
  const [album, setAlbum] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    setErr("");
    setAlbum(null);

    const key = String(shareId || "").trim();
    if (!key) {
      setErr("MISSING_SHARE_ID");
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
      <div className="page-title">Product</div>

      {/* Keep the "Back to Shop" link (matches your screenshots) */}
      <div style={{ marginBottom: 16 }}>
        <Link to="/shop">← Back to Shop</Link>
      </div>

      {err ? (
        <div style={{ color: "#b00020", marginBottom: 12 }}>Error: {err}</div>
      ) : null}
      {!album && !err ? <div style={{ opacity: 0.75 }}>Loading…</div> : null}

      {album ? (
        <div className="layout-60-40">
          {/* LEFT (60%) */}
          <div className="layout-left">
            <div className="cover-art" style={{ marginBottom: 18 }}>
              {album.coverUrl ? (
                <img src={album.coverUrl} alt={album.title || "Cover"} />
              ) : (
                <div className="cover-art-placeholder">No cover</div>
              )}
            </div>

            <div className="card">
              <div className="card-header">Tracks</div>

              <div className="track-list">
                {tracks.length === 0 ? (
                  <div style={{ opacity: 0.8 }}>No tracks found.</div>
                ) : (
                  tracks.map((t, i) => {
                    const isActive =
                      currentTrack && String(currentTrack.id) === String(t.id);

                    return (
                      <div
                        key={t.id || i}
                        className={`track-item ${isActive ? "active" : ""}`}
                        onClick={() => onPlayTrack && onPlayTrack(t)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onPlayTrack && onPlayTrack(t);
                          }
                        }}
                      >
                        <div className="track-number">{i + 1}.</div>
                        <div className="track-name">
                          {t.title || `Track ${i + 1}`}
                        </div>
                        <div className="track-duration"></div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* RIGHT (40%) */}
          <div className="layout-right">
            <div className="card album-info">
              <div className="card-header">Album</div>
              <div className="album-name">{album.title || "Untitled"}</div>
              <div className="album-performer">{album.artist || ""}</div>
              <div className="album-date" style={{ marginTop: 6, opacity: 0.8 }}>
                shareId: {shareId}
              </div>
            </div>

            <button
              className="buy-button"
              onClick={() => {
                // placeholder for now
                alert("Buy flow later (Phase 2+).");
              }}
            >
              Buy
            </button>

            <div className="card marketing-info">
              <div className="card-header">Info</div>
              <h4>What you get</h4>
              <ul>
                <li>Preview playback in Product</li>
                <li>Full playback in Account after unlock (later)</li>
                <li>Fresh signed URLs per play</li>
              </ul>
            </div>

            <div className="card">
              <div className="card-header">Navigate</div>
              <div className="mini-nav">
                <NavLink className="mini-nav-item" to="/shop">
                  Back to Shop
                </NavLink>
                <NavLink className="mini-nav-item" to={`/account/${shareId}`}>
                  Go to Account
                </NavLink>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
