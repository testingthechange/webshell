/* ======================================================================
   FILE: src/routes/Account.jsx
   PURPOSE:
   - Two-column Account layout
   - "My Collection" row + popup
   - Covers ALWAYS load by signing coverS3Key via /api/playback-url
   - Main album cover ALSO signs manifest.coverS3Key (never relies on expired previewUrl)
   ====================================================================== */

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AccountPlayerBar from "../components/AccountPlayerBar.jsx";
import loadManifest from "../lib/loadManifest.js";

const COLLECTION_KEY = "bb_collection_v1";

const API_BASE =
  String(import.meta?.env?.VITE_API_BASE || "").trim().replace(/\/+$/, "") ||
  "https://album-backend-kmuo.onrender.com";

/* ---------------- helpers ---------------- */

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function readCollection() {
  const raw = localStorage.getItem(COLLECTION_KEY);
  const arr = safeParse(raw || "[]");
  return Array.isArray(arr) ? arr.filter(Boolean) : [];
}

async function signUrl(s3Key) {
  const key = String(s3Key || "").trim();
  if (!key) return "";
  const r = await fetch(`${API_BASE}/api/playback-url?s3Key=${encodeURIComponent(key)}`, {
    cache: "no-store",
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.ok) return "";
  return String(j?.url || j?.playbackUrl || "");
}

function pickTracks(manifest) {
  if (!manifest) return [];
  if (Array.isArray(manifest.tracks)) return manifest.tracks;
  if (Array.isArray(manifest.songs)) return manifest.songs;
  if (Array.isArray(manifest.items)) return manifest.items;
  if (Array.isArray(manifest?.album?.tracks)) return manifest.album.tracks;
  return [];
}

function trackId(t, i) {
  return t?.id || t?.trackId || t?.shareTrackId || t?.s3Key || `${i}`;
}

function Section({ title, children, right }) {
  return (
    <div style={sectionStyle}>
      {title ? (
        <div style={sectionHeader}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>
          {right || null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/* ---------------- component ---------------- */

export default function Account() {
  const { shareId = "" } = useParams();
  const nav = useNavigate();
  const audioRef = useRef(null);

  const [manifest, setManifest] = useState(null);
  const [error, setError] = useState("");

  const [collection, setCollection] = useState(() => readCollection());
  const [collectionOpen, setCollectionOpen] = useState(false);

  // signed cover urls cache:
  // - per shareId for collection tiles
  // - plus current page cover url
  const [signedCovers, setSignedCovers] = useState({});
  const [pageCoverUrl, setPageCoverUrl] = useState("");

  const tracks = useMemo(() => pickTracks(manifest), [manifest]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentTrack, setCurrentTrack] = useState(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const owned = useMemo(() => {
    if (!shareId) return false;
    try {
      return localStorage.getItem(`mock_owned:${shareId}`) === "1";
    } catch {
      return false;
    }
  }, [shareId]);

  // refresh collection when popup opens / shareId changes
  useEffect(() => {
    setCollection(readCollection());
  }, [shareId, collectionOpen]);

  // load manifest for current shareId
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setError("");
        setManifest(null);
        setPageCoverUrl("");
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
        setCurrentIndex(0);
        setCurrentTrack(null);

        if (!shareId) return;

        const m = await loadManifest(shareId);
        if (cancelled) return;

        setManifest(m);

        const ts = pickTracks(m);
        if (ts.length) {
          setCurrentIndex(0);
          setCurrentTrack(ts[0]);
        }

        // IMPORTANT: cover comes from coverS3Key -> sign it
        const coverKey = String(m?.coverS3Key || "").trim();
        if (coverKey) {
          const url = await signUrl(coverKey);
          if (!cancelled) setPageCoverUrl(url || "");
        }
      } catch (e) {
        if (!cancelled) setError(String(e?.message || e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [shareId]);

  // sign missing collection cover urls (from entry.coverS3Key)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const rows = readCollection();
      for (const a of rows) {
        const id = String(a?.shareId || "").trim();
        const key = String(a?.coverS3Key || "").trim();
        if (!id || !key) continue;
        if (signedCovers[id]) continue;

        const url = await signUrl(key);
        if (cancelled) return;
        if (url) setSignedCovers((p) => ({ ...p, [id]: url }));
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionOpen, shareId, collection.length]);

  function onSeek(newTime) {
    const a = audioRef.current;
    if (!a) return;
    try {
      a.currentTime = newTime;
      setCurrentTime(newTime);
    } catch {}
  }

  function selectTrack(i) {
    const t = tracks[i];
    if (!t) return;
    setCurrentIndex(i);
    setCurrentTrack(t);
    setIsPlaying(true);
  }

  function prevTrack() {
    if (currentIndex > 0) selectTrack(currentIndex - 1);
  }

  function nextTrack() {
    if (currentIndex < tracks.length - 1) selectTrack(currentIndex + 1);
  }

  function openCollection() {
    setCollection(readCollection());
    setCollectionOpen(true);
  }

  function collectionCoverUrl(a) {
    const id = String(a?.shareId || "").trim();
    return String(signedCovers[id] || "").trim();
  }

  const title =
    manifest?.title || manifest?.name || manifest?.album?.title || manifest?.album?.name || "Account";
  const artist = manifest?.artist || manifest?.album?.artist || "";
  const description = manifest?.description || manifest?.album?.description || "";

  return (
    <div style={{ width: "70%", maxWidth: 1320, margin: "0 auto", padding: "28px 0" }}>
      {error ? (
        <Section title="Error">
          <div style={{ opacity: 0.85, whiteSpace: "pre-wrap" }}>{error}</div>
        </Section>
      ) : null}

      {/* MY COLLECTION THUMBNAIL ROW */}
      {collection.length ? (
        <Section
          title="My Collection"
          right={
            <button type="button" onClick={openCollection} style={smallLinkBtn}>
              View all
            </button>
          }
        >
          <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 4 }}>
            {collection.map((a) => {
              const img = collectionCoverUrl(a);
              return (
                <button
                  key={a?.shareId}
                  type="button"
                  onClick={() => a?.shareId && nav(`/account/${a.shareId}`)}
                  style={thumbItem}
                >
                  <div style={thumbBox}>
                    {img ? (
                      <img
                        src={img}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                    ) : (
                      <div style={coverPlaceholder}>COVER</div>
                    )}
                  </div>

                  <div style={{ fontWeight: 800, fontSize: 12, marginTop: 6 }}>
                    {a?.title || "Album"}
                  </div>
                  {a?.artist ? (
                    <div style={{ opacity: 0.7, fontSize: 11, marginTop: 2 }}>{a.artist}</div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </Section>
      ) : null}

      {/* COLLECTION POPUP */}
      {collectionOpen ? (
        <div style={popupOverlay} onMouseDown={() => setCollectionOpen(false)}>
          <div style={popupCard} onMouseDown={(e) => e.stopPropagation()}>
            <div style={popupHeader}>
              <div style={{ fontWeight: 900 }}>My Collection</div>
              <button
                type="button"
                onClick={() => setCollectionOpen(false)}
                style={closeBtn}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div style={{ padding: 12 }}>
              {collection.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {collection.map((a) => {
                    const img = collectionCoverUrl(a);
                    return (
                      <button
                        key={a?.shareId}
                        type="button"
                        onClick={() => {
                          setCollectionOpen(false);
                          if (a?.shareId) nav(`/account/${a.shareId}`);
                        }}
                        style={albumRow}
                      >
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <div style={thumbSmall}>
                            {img ? (
                              <img
                                src={img}
                                alt=""
                                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                              />
                            ) : (
                              <div style={coverPlaceholderSmall}>COVER</div>
                            )}
                          </div>

                          <div style={{ textAlign: "left" }}>
                            <div style={{ fontWeight: 900 }}>{a?.title || "Album"}</div>
                            <div style={{ opacity: 0.75, fontSize: 12 }}>{a?.artist || ""}</div>
                            <div style={{ opacity: 0.55, fontSize: 12 }}>{a?.shareId || ""}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div style={{ opacity: 0.75 }}>No purchases yet.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* TWO COLUMN LAYOUT */}
      <div style={{ display: "grid", gridTemplateColumns: "60% 40%", gap: 32, marginTop: 32 }}>
        {/* COLUMN ONE — COVER ONLY */}
        <div>
          <div style={pageCoverBox}>
            {pageCoverUrl ? (
              <img
                src={pageCoverUrl}
                alt="Cover"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            ) : (
              <div style={pageCoverPlaceholder}>COVER</div>
            )}
          </div>
        </div>

        {/* COLUMN TWO */}
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <Section
            title={title}
            right={<span style={{ opacity: 0.8 }}>{owned ? "Owned" : "Not owned"}</span>}
          >
            {artist ? <div style={{ opacity: 0.7 }}>{artist}</div> : null}
            {description ? (
              <div style={{ marginTop: 10, lineHeight: 1.6 }}>{description}</div>
            ) : null}
            {shareId ? (
              <div style={{ marginTop: 10, opacity: 0.55, fontSize: 12 }}>{shareId}</div>
            ) : null}
          </Section>

          <Section title="Menu">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button type="button" style={miniNavBtn} onClick={openCollection}>
                My Collection
              </button>
              <button type="button" style={miniNavBtn}>
                Playlist
              </button>
              <button type="button" style={miniNavBtn}>
                Swag
              </button>
              <button type="button" style={miniNavBtn}>
                Other
              </button>
            </div>
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
              Playlist / Swag / Other are placeholders.
            </div>
          </Section>

          <Section title="Tracks" right={<span style={{ opacity: 0.75 }}>{tracks.length}</span>}>
            {tracks?.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {tracks.map((t, i) => {
                  const label = t?.title || t?.name || `Track ${i + 1}`;
                  const active = i === currentIndex;
                  return (
                    <button
                      key={trackId(t, i)}
                      type="button"
                      onClick={() => selectTrack(i)}
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.12)",
                        background: active ? "rgba(255,255,255,0.10)" : "transparent",
                        color: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ opacity: 0.7, marginRight: 8 }}>{i + 1}.</span>
                      {label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div style={{ opacity: 0.75 }}>No tracks.</div>
            )}
          </Section>
        </div>
      </div>

      {/* PLAYER — BOTTOM ONLY */}
      <div style={{ marginTop: 40 }}>
        <Section>
          <AccountPlayerBar
            audioRef={audioRef}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            playbackMode="full"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onTimeUpdate={(t) => setCurrentTime(t)}
            onDurationChange={(d) => setDuration(d)}
            onSeek={onSeek}
            onTrackEnd={() => setIsPlaying(false)}
            onPrev={prevTrack}
            onNext={nextTrack}
            hasPrev={currentIndex > 0}
            hasNext={currentIndex < tracks.length - 1}
          />
        </Section>
      </div>
    </div>
  );
}

/* ---------------- styles ---------------- */

const sectionStyle = {
  padding: 18,
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.03)",
};

const sectionHeader = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: 12,
};

const thumbItem = {
  minWidth: 220,
  textAlign: "left",
  background: "transparent",
  border: "none",
  color: "#fff",
  cursor: "pointer",
};

const thumbBox = {
  width: 220,
  aspectRatio: "1 / 1",
  borderRadius: 22,
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.05)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const coverPlaceholder = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  letterSpacing: 2,
  opacity: 0.6,
  fontSize: 14,
};

const coverPlaceholderSmall = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  letterSpacing: 2,
  opacity: 0.6,
  fontSize: 11,
};

const smallLinkBtn = {
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};

const miniNavBtn = {
  width: "100%",
  padding: "12px 12px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  fontWeight: 900,
  textAlign: "left",
  cursor: "pointer",
};

const popupOverlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.55)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 50,
  padding: 16,
};

const popupCard = {
  width: 560,
  maxWidth: "100%",
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(10,10,10,0.94)",
  backdropFilter: "blur(10px)",
  boxShadow: "0 22px 80px rgba(0,0,0,0.55)",
  overflow: "hidden",
};

const popupHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 12px",
  borderBottom: "1px solid rgba(255,255,255,0.10)",
};

const closeBtn = {
  width: 34,
  height: 34,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  cursor: "pointer",
};

const albumRow = {
  width: "100%",
  padding: 12,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  cursor: "pointer",
};

const thumbSmall = {
  width: 46,
  height: 46,
  borderRadius: 12,
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const pageCoverBox = {
  width: "100%",
  aspectRatio: "1 / 1",
  borderRadius: 24,
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const pageCoverPlaceholder = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  letterSpacing: 2,
  opacity: 0.55,
  fontSize: 14,
};
