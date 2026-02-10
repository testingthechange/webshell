// FILE: src/routes/Account.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import AccountPlayerBar from "../components/AccountPlayerBar.jsx";
import loadManifest from "../lib/loadManifest.js";

// Smart Bridge (account-only)
import SmartBridgeCard from "../components/account/SmartBridgeCard.jsx";
import { useAccountPlaybackMode } from "../components/account/useAccountPlaybackMode.js";
import * as SmartBridgePlaybackModule from "../components/account/useSmartBridgePlayback.js";

// ✅ support either named or default export from the hook module
const useSmartBridgePlayback =
  SmartBridgePlaybackModule.useSmartBridgePlayback || SmartBridgePlaybackModule.default;

const COLLECTION_KEY = "bb_collection_v1";

const API_BASE =
  String(import.meta?.env?.VITE_API_BASE || "")
    .trim()
    .replace(/\/+$/, "") || "https://album-backend-kmuo.onrender.com";

/* ---------------- helpers ---------------- */

function safeString(v) {
  return String(v ?? "").trim();
}

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function readCollectionRaw() {
  const raw = localStorage.getItem(COLLECTION_KEY);
  const parsed = raw ? safeParse(raw) : null;
  return Array.isArray(parsed) ? parsed : [];
}

function loadCollectionIds() {
  const parsed = readCollectionRaw();
  const out = [];

  for (const x of parsed) {
    if (!x) continue;
    if (typeof x === "string") out.push(safeString(x));
    else out.push(safeString(x?.shareId || x?.id || x?.share_id || x?.shareID || ""));
  }

  const seen = new Set();
  const deduped = [];
  for (const id of out) {
    const v = safeString(id);
    if (!v || seen.has(v)) continue;
    seen.add(v);
    deduped.push(v);
  }
  return deduped;
}

function saveCollectionIds(ids) {
  const cleaned = [];
  const seen = new Set();
  for (const x of ids || []) {
    const id = safeString(x);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    cleaned.push(id);
  }
  localStorage.setItem(COLLECTION_KEY, JSON.stringify(cleaned));
  return cleaned;
}

function ensureShareIdInCollection(shareId) {
  const id = safeString(shareId);
  if (!id) return [];
  const existing = loadCollectionIds();
  const next = [id, ...existing.filter((x) => x !== id)];
  return saveCollectionIds(next);
}

function isOwned(shareId, collectionIdsOverride) {
  const id = safeString(shareId);
  if (!id) return false;

  try {
    if (localStorage.getItem(`mock_owned:${id}`) === "1") return true;
  } catch {}

  const ids = Array.isArray(collectionIdsOverride) ? collectionIdsOverride : loadCollectionIds();
  return ids.includes(id);
}

async function fetchJson(url) {
  const r = await fetch(url, { cache: "no-store" });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error((j && (j.error || j.message)) || `HTTP ${r.status}`);
  return j;
}

async function signUrl(s3Key) {
  const key = safeString(s3Key);
  if (!key) return "";
  const j = await fetchJson(`${API_BASE}/api/playback-url?s3Key=${encodeURIComponent(key)}`);
  return safeString(j?.url || j?.playbackUrl || "");
}

function pickTitle(m) {
  return (
    safeString(m?.title) ||
    safeString(m?.name) ||
    safeString(m?.album?.title) ||
    safeString(m?.album?.name) ||
    safeString(m?.meta?.albumTitle) ||
    safeString(m?.snapshot?.album?.meta?.albumTitle) ||
    safeString(m?.snapshot?.album?.masterSave?.meta?.albumTitle) ||
    "Untitled"
  );
}

function pickArtist(m) {
  return (
    safeString(m?.artist) ||
    safeString(m?.album?.artist) ||
    safeString(m?.meta?.artist) ||
    safeString(m?.snapshot?.album?.meta?.artistName) ||
    safeString(m?.snapshot?.album?.masterSave?.meta?.artistName) ||
    "Unknown artist"
  );
}

function pickDescription(m) {
  return (
    safeString(m?.description) ||
    safeString(m?.album?.description) ||
    safeString(m?.meta?.description) ||
    safeString(m?.snapshot?.album?.meta?.description) ||
    safeString(m?.snapshot?.album?.masterSave?.meta?.description) ||
    ""
  );
}

function pickCoverKey(m) {
  return (
    safeString(m?.coverS3Key) ||
    safeString(m?.album?.coverKey) ||
    safeString(m?.coverKey) ||
    safeString(m?.artworkKey) ||
    safeString(m?.album?.artworkKey) ||
    safeString(m?.snapshot?.album?.cover?.s3Key) ||
    safeString(m?.snapshot?.album?.masterSave?.cover?.s3Key) ||
    ""
  );
}

function pickTracks(m) {
  // Published wrapper shape: { snapshot: { catalog: { songs: [...] } } }
  if (Array.isArray(m?.tracks)) return m.tracks;
  if (Array.isArray(m?.album?.tracks)) return m.album.tracks;
  if (Array.isArray(m?.snapshot?.catalog?.songs)) return m.snapshot.catalog.songs;
  if (Array.isArray(m?.catalog?.songs)) return m.catalog.songs;
  if (Array.isArray(m?.project?.catalog?.songs)) return m.project.catalog.songs;
  return [];
}

function pickConnectionsAny(m) {
  // Handles:
  // - published wrapper { snapshot: { songs: { connections } } }
  // - manifest-ish { songs: { connections } }
  // - other variants
  const candidates = [
    m?.snapshot?.songs?.connections,
    m?.snapshot?.smartBridge?.connections,
    m?.snapshot?.songs?.songConnections,
    m?.songs?.connections,
    m?.smartBridge?.connections,
    m?.manifest?.snapshot?.songs?.connections,
    m?.manifest?.songs?.connections,
  ];

  for (const c of candidates) {
    if (c && typeof c === "object" && !Array.isArray(c)) return c;
  }
  return {};
}

function pickTrackAudioKeyAlbum(t) {
  const filesAlbum = safeString(t?.files?.album?.s3Key);
  if (filesAlbum) return filesAlbum;

  return (
    safeString(t?.s3Key) ||
    safeString(t?.audioS3Key) ||
    safeString(t?.trackS3Key) ||
    safeString(t?.playbackKey) ||
    safeString(t?.fileKey) ||
    safeString(t?.audioKey) ||
    ""
  );
}

function pickTrackAudioKeySmart(t, choice) {
  const ch = choice === "b" ? "b" : "a";
  const key = safeString(t?.files?.[ch]?.s3Key);
  if (key) return key;
  return pickTrackAudioKeyAlbum(t);
}

function trackId(t, i) {
  return safeString(t?.id) || safeString(t?.s3Key) || safeString(t?.audioS3Key) || `track:${i}`;
}

function pickTrackTitle(t, i) {
  return safeString(t?.title) || safeString(t?.name) || `Track ${i + 1}`;
}

function pickTrackSlot(t, i) {
  const v = Number(t?.slot);
  if (Number.isFinite(v) && v > 0) return v;
  return i + 1;
}

/* ---------------- component ---------------- */

export default function Account() {
  const nav = useNavigate();
  const params = useParams();
  const [sp] = useSearchParams();

  const routeShareId =
    safeString(params?.shareId) ||
    safeString(params?.id) ||
    safeString(params?.shareid) ||
    safeString(params?.shareID) ||
    safeString(sp.get("shareId")) ||
    safeString(sp.get("id"));

  const purchasedFlag = safeString(sp.get("purchased")) === "1";

  // ONE audio element for songs + bridges (autoplay-safe)
  const songAudioRef = useRef(null);

  const [collection, setCollection] = useState([]);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [signedCovers, setSignedCovers] = useState({});

  const [shareId, setShareId] = useState("");
  const [manifest, setManifest] = useState(null);
  const [pageCoverUrl, setPageCoverUrl] = useState("");
  const [tracks, setTracks] = useState([]);

  // Connections derived from manifest (handles published wrapper shape)
  const connections = useMemo(() => pickConnectionsAny(manifest), [manifest]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentTrack, setCurrentTrack] = useState(null);

  // Choice used for CURRENT song in smartBridge mode (A/B)
  const [currentChoice, setCurrentChoice] = useState("a");

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const [error, setError] = useState("");

  const [collectionIds, setCollectionIds] = useState(() => loadCollectionIds());
  const owned = useMemo(() => isOwned(shareId, collectionIds), [shareId, collectionIds.join("|")]);

  const { mode, setMode } = useAccountPlaybackMode({ shareId });

  /* ---------- Smart Bridge: Now Playing + highlight state ---------- */

  const [sbNowPlayingLabel, setSbNowPlayingLabel] = useState("");
  const [sbActiveSlot, setSbActiveSlot] = useState(null);
  const [sbHighlightVisible, setSbHighlightVisible] = useState(false);
  const sbHighlightTimerRef = useRef(null);

  function clearSbHighlightTimer() {
    if (sbHighlightTimerRef.current) {
      clearTimeout(sbHighlightTimerRef.current);
      sbHighlightTimerRef.current = null;
    }
  }

  function bumpSmartBridgeNowPlaying(t, i) {
    const slot = pickTrackSlot(t, i);
    const title = pickTrackTitle(t, i);
    setSbActiveSlot(slot);
    setSbNowPlayingLabel(`${slot}. ${title}`);

    setSbHighlightVisible(true);
    clearSbHighlightTimer();
    sbHighlightTimerRef.current = setTimeout(() => {
      setSbHighlightVisible(false);
      sbHighlightTimerRef.current = null;
    }, 100_000);
  }

  /* ---------- localStorage sync ---------- */

  useEffect(() => {
    const onStorage = (e) => {
      if (e?.key === COLLECTION_KEY) {
        setCollectionIds(loadCollectionIds());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /* ---------- purchase landing self-heal ---------- */

  useEffect(() => {
    const id = safeString(routeShareId);
    if (!id) return;

    const existing = loadCollectionIds();

    let shouldAdd = false;
    if (purchasedFlag) shouldAdd = true;

    if (!shouldAdd) {
      try {
        const raw = sessionStorage.getItem("bb_last_purchase_v1");
        const j = raw ? safeParse(raw) : null;
        const sid = safeString(j?.shareId);
        const ts = Number(j?.ts || 0);
        if (sid && sid === id && Number.isFinite(ts) && Date.now() - ts < 10 * 60 * 1000) {
          shouldAdd = true;
          sessionStorage.removeItem("bb_last_purchase_v1");
        }
      } catch {}
    }

    if (!shouldAdd && existing.length === 0) shouldAdd = true;
    if (!shouldAdd) return;

    ensureShareIdInCollection(id);
    try {
      localStorage.setItem(`mock_owned:${id}`, "1");
    } catch {}

    setCollectionIds(loadCollectionIds());
  }, [routeShareId, purchasedFlag]);

  /* ---------- navigation helpers ---------- */

  function selectTrack(i, opts) {
    const t = tracks?.[i];
    if (!t) return;

    const nextChoice = safeString(opts?.choice) === "b" ? "b" : "a";
    const autoplay = opts?.autoplay !== false;

    setCurrentIndex(i);
    setCurrentTrack(t);

    if (mode === "smartBridge") {
      setCurrentChoice(nextChoice);
      bumpSmartBridgeNowPlaying(t, i);
    } else {
      setCurrentChoice("a");
      setSbNowPlayingLabel("");
      setSbActiveSlot(null);
      setSbHighlightVisible(false);
      clearSbHighlightTimer();
    }

    if (autoplay) {
      setIsPlaying(true);
      try {
        songAudioRef.current?.play?.();
      } catch {}
    }
  }

  function prevTrack() {
    if (currentIndex > 0) selectTrack(currentIndex - 1, { autoplay: true });
  }

  function nextTrack() {
    if (currentIndex < tracks.length - 1) selectTrack(currentIndex + 1, { autoplay: true });
  }

  function onSeek(t) {
    const a = songAudioRef.current;
    if (!a) return;
    a.currentTime = t;
    setCurrentTime(t);
  }

  /* ---------- Smart Bridge Playback (ONE audio element; swaps src to bridge) ---------- */

  const { handleEnded, phase, endedAll } = useSmartBridgePlayback({
    audioRef: songAudioRef,
    tracks,
    connections,
    signUrl,
    mode,
    isPlaying,
    currentIndex,
    currentTrack,
    setIsPlaying,
    selectTrack,
  });

  /* ---------- keep Smart Bridge "Now Playing" in sync ---------- */

  useEffect(() => {
    if (mode !== "smartBridge") return;

    if (endedAll) {
      setSbNowPlayingLabel("—");
      setSbActiveSlot(null);
      setSbHighlightVisible(false);
      clearSbHighlightTimer();
      return;
    }

    if (phase === "bridge") {
      setSbNowPlayingLabel("→ bridge");
      setSbActiveSlot(null);
      setSbHighlightVisible(false);
      clearSbHighlightTimer();
      return;
    }

    if (currentTrack) bumpSmartBridgeNowPlaying(currentTrack, currentIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, phase, endedAll, currentIndex, currentTrack]);

  /* ---------- load active page album ---------- */

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const id = safeString(routeShareId);

      setShareId(id);
      setError("");
      setManifest(null);
      setPageCoverUrl("");
      setTracks([]);
      setCurrentIndex(0);
      setCurrentTrack(null);
      setCurrentChoice("a");
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);

      setSbNowPlayingLabel("");
      setSbActiveSlot(null);
      setSbHighlightVisible(false);
      clearSbHighlightTimer();

      // hard reset audio
      try {
        const s = songAudioRef.current;
        if (s) {
          s.pause?.();
          s.removeAttribute("src");
          s.load?.();
        }
      } catch {}

      if (!id) return;

      try {
        const m = await loadManifest(id);
        if (cancelled) return;

        setManifest(m);

        // Debug: confirm connections exist
        try {
          const c = pickConnectionsAny(m);
          console.log("[SB] Account connections loaded", {
            count: Object.keys(c || {}).length,
            sample: Object.keys(c || {}).slice(0, 12),
            shapeKeys: Object.keys(m || {}).slice(0, 20),
            snapshotKeys: Object.keys(m?.snapshot || {}).slice(0, 20),
          });
        } catch {}

        const raw = pickTracks(m);

        // keep songs with album OR A/B
        const playable = (raw || [])
          .filter((t) => {
            const hasAlbum = !!pickTrackAudioKeyAlbum(t);
            const hasA = !!safeString(t?.files?.a?.s3Key);
            const hasB = !!safeString(t?.files?.b?.s3Key);
            return hasAlbum || hasA || hasB;
          })
          .sort((a, b) => (Number(a?.slot) || 0) - (Number(b?.slot) || 0));

        setTracks(playable);

        if (playable.length) {
          setCurrentIndex(0);
          setCurrentTrack(playable[0]);
          setCurrentChoice("a");
        }

        const coverKey = pickCoverKey(m);
        const url = coverKey ? await signUrl(coverKey) : "";
        if (!cancelled) setPageCoverUrl(url || "");
      } catch (e) {
        if (!cancelled) setError(String(e?.message || e));
      }
    })();

    return () => {
      cancelled = true;
      clearSbHighlightTimer();
    };
  }, [routeShareId]);

  /* ---------- bind SONG audio src (do NOT stomp while bridge phase is playing) ---------- */

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (mode === "smartBridge" && phase === "bridge") return;

      const a = songAudioRef.current;
      const t = currentTrack;
      if (!a || !t) return;

      const key =
        mode === "smartBridge" ? pickTrackAudioKeySmart(t, currentChoice) : pickTrackAudioKeyAlbum(t);

      if (!key) return;

      try {
        const url = await signUrl(key);
        if (cancelled || !url) return;

        if (a.src !== url) {
          a.src = url;
          a.load?.();
        }

        if (isPlaying) {
          a.play?.().catch(() => {});
        }
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, [currentTrack, isPlaying, mode, currentChoice, phase]);

  /* ---------- collection model + cover signing ---------- */

  function readCollection() {
    const ids = loadCollectionIds();

    let lib = [];
    try {
      const raw = localStorage.getItem("mock_library");
      const parsed = raw ? safeParse(raw) : null;
      if (Array.isArray(parsed)) lib = parsed;
    } catch {}

    const byId = new Map();
    for (const x of lib) {
      const sid = safeString(x?.shareId || x?.id);
      if (!sid) continue;
      byId.set(sid, x);
    }

    return ids.map((sid) => {
      const x = byId.get(sid) || {};
      return {
        shareId: sid,
        title: safeString(x?.title) || "Album",
        artist: safeString(x?.artist) || "",
        coverUrl: safeString(x?.coverUrl) || "",
        purchasedAt: x?.purchasedAt || "",
      };
    });
  }

  function openCollection() {
    const next = readCollection();
    setCollection(next);
    setCollectionOpen(true);
  }

  function collectionCoverUrl(a) {
    const id = safeString(a?.shareId);
    return safeString(signedCovers?.[id] || "");
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const ids = (collection || []).map((a) => safeString(a?.shareId)).filter(Boolean);

      for (const id of ids) {
        if (cancelled) return;
        if (signedCovers[id]) continue;

        try {
          const m = await loadManifest(id);
          if (cancelled) return;

          const coverKey = pickCoverKey(m);
          if (!coverKey) continue;

          const url = await signUrl(coverKey);
          if (cancelled || !url) continue;

          setSignedCovers((prev) => ({ ...prev, [id]: url }));
        } catch {}
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionOpen, (collection || []).map((x) => safeString(x?.shareId)).join("|")]);

  const title = pickTitle(manifest) || "Account";
  const artist = pickArtist(manifest) || "";
  const description = pickDescription(manifest) || "";

  return (
    <div style={{ width: "70%", maxWidth: 1320, margin: "0 auto", padding: "28px 0" }}>
      <audio
        ref={songAudioRef}
        preload="auto"
        style={{ display: "none" }}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onEnded={handleEnded}
      />

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
            {collection.map((a, idx) => {
              const img = collectionCoverUrl(a);
              const sid = safeString(a?.shareId) || `item:${idx}`;
              return (
                <button
                  key={`${sid}:${idx}`}
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

                  <div style={{ fontWeight: 800, fontSize: 12, marginTop: 6 }}>{a?.title || "Album"}</div>
                  {a?.artist ? <div style={{ opacity: 0.7, fontSize: 11, marginTop: 2 }}>{a.artist}</div> : null}
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
              <button type="button" onClick={() => setCollectionOpen(false)} style={closeBtn} aria-label="Close">
                ✕
              </button>
            </div>

            <div style={{ padding: 12 }}>
              {collection.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {collection.map((a, idx) => {
                    const img = collectionCoverUrl(a);
                    const sid = safeString(a?.shareId) || `row:${idx}`;
                    return (
                      <button
                        key={`${sid}:${idx}`}
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
          <Section title={title} right={<span style={{ opacity: 0.8 }}>{owned ? "Owned" : "Not owned"}</span>}>
            {artist ? <div style={{ opacity: 0.7 }}>{artist}</div> : null}
            {description ? <div style={{ marginTop: 10, lineHeight: 1.6 }}>{description}</div> : null}
            {shareId ? <div style={{ marginTop: 10, opacity: 0.55, fontSize: 12 }}>{shareId}</div> : null}
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
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>Playlist / Swag / Other are placeholders.</div>
          </Section>

          {mode === "smartBridge" ? (
            <SmartBridgeCard
              tracks={tracks}
              nowPlayingLabel={sbNowPlayingLabel}
              activeSlot={sbActiveSlot}
              highlightVisible={sbHighlightVisible}
            />
          ) : (
            <Section title="Tracks" right={<span style={{ opacity: 0.75 }}>{tracks.length}</span>}>
              {tracks?.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {tracks.map((t, i) => {
                    const label = pickTrackTitle(t, i);
                    const active = i === currentIndex;
                    return (
                      <button
                        key={trackId(t, i)}
                        type="button"
                        onClick={() => selectTrack(i, { autoplay: true })}
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
          )}
        </div>
      </div>

      {/* PLAYER — BOTTOM ONLY */}
      <div style={{ marginTop: 40 }}>
        <Section>
          <AccountPlayerBar
            audioRef={songAudioRef}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            onPlay={() => {
              setIsPlaying(true);
              if (mode === "smartBridge" && currentTrack) bumpSmartBridgeNowPlaying(currentTrack, currentIndex);
            }}
            onPause={() => setIsPlaying(false)}
            onTimeUpdate={(t) => setCurrentTime(t)}
            onDurationChange={(d) => setDuration(d)}
            onSeek={onSeek}
            onTrackEnd={() => {
              if (mode !== "smartBridge") setIsPlaying(false);
            }}
            onPrev={prevTrack}
            onNext={nextTrack}
            hasPrev={currentIndex > 0}
            hasNext={currentIndex < tracks.length - 1}
            playbackMode={mode}
            onPlaybackModeChange={(nextMode) => {
              setMode(nextMode);

              if (nextMode !== "smartBridge") {
                setSbNowPlayingLabel("");
                setSbActiveSlot(null);
                setSbHighlightVisible(false);
                clearSbHighlightTimer();
              } else if (isPlaying && currentTrack) {
                bumpSmartBridgeNowPlaying(currentTrack, currentIndex);
              }
            }}
          />
        </Section>
      </div>
    </div>
  );
}

/* ---------------- small components ---------------- */

function Section({ title, right, children }) {
  return (
    <div style={sectionStyle}>
      {title || right ? (
        <div style={sectionHeader}>
          <div style={{ fontWeight: 900 }}>{title || ""}</div>
          <div>{right || null}</div>
        </div>
      ) : null}
      {children}
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

const thumbSmall = {
  width: 56,
  height: 56,
  borderRadius: 14,
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.05)",
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
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

const popupOverlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.55)",
  zIndex: 50,
  display: "grid",
  placeItems: "center",
  padding: 18,
};

const popupCard = {
  width: "min(860px, 96vw)",
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(20,20,20,0.92)",
  backdropFilter: "blur(12px)",
  overflow: "hidden",
};

const popupHeader = {
  padding: 14,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  borderBottom: "1px solid rgba(255,255,255,0.10)",
};

const closeBtn = {
  width: 38,
  height: 34,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 900,
};

const albumRow = {
  width: "100%",
  textAlign: "left",
  padding: 14,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.04)",
  color: "#fff",
  cursor: "pointer",
};

const pageCoverBox = {
  width: "100%",
  aspectRatio: "1 / 1",
  borderRadius: 24,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
};

const pageCoverPlaceholder = {
  opacity: 0.6,
  letterSpacing: 2,
};

const miniNavBtn = {
  padding: "12px 12px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
};
