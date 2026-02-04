// FILE: src/routes/Account.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import AccountPlayerBar from "../components/AccountPlayerBar.jsx";
import loadManifest from "../lib/loadManifest.js";

import SmartBridgeCard from "../components/account/SmartBridgeCard.jsx";
import { useAccountPlaybackMode } from "../components/account/useAccountPlaybackMode.js";

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

function randInt(min, max) {
  const a = Math.ceil(min);
  const b = Math.floor(max);
  return Math.floor(a + Math.random() * (b - a + 1));
}

function shuffle(arr) {
  const a = Array.isArray(arr) ? [...arr] : [];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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

async function loadPublishedRaw(shareId) {
  const id = safeString(shareId);
  if (!id) return null;
  try {
    const url = `${API_BASE}/publish/${encodeURIComponent(id)}.json`;
    return await fetchJson(url);
  } catch {
    return null;
  }
}

function pickTitle(m) {
  return (
    safeString(m?.title) ||
    safeString(m?.name) ||
    safeString(m?.album?.title) ||
    safeString(m?.album?.name) ||
    safeString(m?.meta?.albumTitle) ||
    "Untitled"
  );
}

function pickArtist(m) {
  return (
    safeString(m?.artist) ||
    safeString(m?.album?.artist) ||
    safeString(m?.meta?.artist) ||
    "Unknown artist"
  );
}

function pickDescription(m) {
  return (
    safeString(m?.description) ||
    safeString(m?.album?.description) ||
    safeString(m?.meta?.description) ||
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
    ""
  );
}

function pickTracks(m) {
  if (Array.isArray(m?.tracks)) return m.tracks;
  if (Array.isArray(m?.album?.tracks)) return m.album.tracks;
  if (Array.isArray(m?.catalog?.songs)) return m.catalog.songs;
  if (Array.isArray(m?.project?.catalog?.songs)) return m.project.catalog.songs;
  return [];
}

function pickTrackAudioKey(t) {
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

function trackId(t, i) {
  return safeString(t?.id) || safeString(t?.s3Key) || safeString(t?.audioS3Key) || `track:${i}`;
}

function songTitleFromCatalogSong(s) {
  return safeString(s?.title) || `Song ${safeString(s?.slot) || "?"}`;
}

function getConnection(connections, fromSlot, toSlot) {
  const k = `${Number(fromSlot)}-${Number(toSlot)}`;
  return connections && typeof connections === "object" ? connections[k] : null;
}

function pickSongVariantS3Key(catalogSong, choice) {
  const c = choice === "b" ? "b" : "a";
  return safeString(catalogSong?.files?.[c]?.s3Key || "");
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

  const audioRef = useRef(null);

  const [collection, setCollection] = useState([]);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [signedCovers, setSignedCovers] = useState({});

  const [shareId, setShareId] = useState("");
  const [manifest, setManifest] = useState(null);
  const [pageCoverUrl, setPageCoverUrl] = useState("");

  // Album mode list
  const [tracks, setTracks] = useState([]);

  // Adaptive Album sources (songs page)
  const [sbSongs, setSbSongs] = useState([]); // catalog.songs
  const [sbConnections, setSbConnections] = useState({}); // songs.connections

  // Album mode current
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentTrack, setCurrentTrack] = useState(null);

  // Player base
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const [error, setError] = useState("");

  const [collectionIds, setCollectionIds] = useState(() => loadCollectionIds());
  const owned = useMemo(() => isOwned(shareId, collectionIds), [shareId, collectionIds.join("|")]);

  const { mode, setMode } = useAccountPlaybackMode({ shareId });

  // Adaptive Album UI state
  const [nowPlayingLabel, setNowPlayingLabel] = useState("");
  const [activeSlot, setActiveSlot] = useState(null);
  const [highlightVisible, setHighlightVisible] = useState(false);

  const entranceTimerRef = useRef(null);
  const exitTimerRef = useRef(null);
  const fadeTimerRef = useRef(null);

  // Adaptive Album queue
  const [sbQueue, setSbQueue] = useState([]); // items: { type:'song'|'bridge', slot?, title?, s3Key }
  const [sbQueueIndex, setSbQueueIndex] = useState(0);

  function clearTimers() {
    if (entranceTimerRef.current) window.clearTimeout(entranceTimerRef.current);
    if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);
    if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);
    entranceTimerRef.current = null;
    exitTimerRef.current = null;
    fadeTimerRef.current = null;
  }

  /* ---------- localStorage sync ---------- */

  useEffect(() => {
    const onStorage = (e) => {
      if (e?.key === COLLECTION_KEY) setCollectionIds(loadCollectionIds());
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

  /* ---------- load active page album + songs snapshot ---------- */

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const id = safeString(routeShareId);

      setShareId(id);
      setError("");
      setManifest(null);
      setPageCoverUrl("");
      setTracks([]);
      setSbSongs([]);
      setSbConnections({});

      setCurrentIndex(0);
      setCurrentTrack(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);

      setSbQueue([]);
      setSbQueueIndex(0);
      setNowPlayingLabel("");
      setActiveSlot(null);
      setHighlightVisible(false);
      clearTimers();

      const a = audioRef.current;
      if (a) {
        try {
          a.pause?.();
        } catch {}
        a.removeAttribute("src");
        try {
          a.load?.();
        } catch {}
      }

      if (!id) return;

      // Album mode manifest (existing)
      try {
        const m = await loadManifest(id);
        if (cancelled) return;

        setManifest(m);

        const list = pickTracks(m);
        setTracks(list);

        if (list.length) {
          setCurrentIndex(0);
          setCurrentTrack(list[0]);
        }

        const coverKey = pickCoverKey(m);
        const url = coverKey ? await signUrl(coverKey) : "";
        if (!cancelled) setPageCoverUrl(url || "");
      } catch (e) {
        if (!cancelled) setError(String(e?.message || e));
      }

      // Songs snapshot (Adaptive Album mode)
      const published = await loadPublishedRaw(id);
      if (cancelled) return;

      const snap = published?.snapshot || null;
      const catalogSongs = Array.isArray(snap?.catalog?.songs) ? snap.catalog.songs : [];
      const connections =
        snap?.songs?.connections && typeof snap.songs.connections === "object"
          ? snap.songs.connections
          : {};

      const playable = catalogSongs
        .map((s) => ({
          ...s,
          slot: Number(s?.slot),
          title: safeString(s?.title),
        }))
        .filter(
          (s) =>
            Number.isFinite(s.slot) &&
            s.slot > 0 &&
            s.title &&
            (safeString(s?.files?.a?.s3Key) || safeString(s?.files?.b?.s3Key))
        );

      setSbSongs(playable);
      setSbConnections(connections);
    })();

    return () => {
      cancelled = true;
    };
  }, [routeShareId]);

  /* ---------- bind audio src (Album OR Adaptive queue) ---------- */

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const a = audioRef.current;
      if (!a) return;

      if (mode === "smartBridge") {
        const item = sbQueue[sbQueueIndex] || null;
        const key = safeString(item?.s3Key);
        if (!key) return;

        try {
          const url = await signUrl(key);
          if (cancelled || !url) return;

          if (a.src !== url) {
            a.src = url;
            try {
              a.load?.();
            } catch {}
          }

          if (isPlaying) a.play?.().catch(() => {});
        } catch {}
        return;
      }

      const t = currentTrack;
      if (!t) return;

      const key = pickTrackAudioKey(t);
      if (!key) return;

      try {
        const url = await signUrl(key);
        if (cancelled || !url) return;

        if (a.src !== url) {
          a.src = url;
          try {
            a.load?.();
          } catch {}
        }

        if (isPlaying) a.play?.().catch(() => {});
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, [mode, sbQueueIndex, sbQueue, currentTrack, isPlaying]);

  /* ---------- Album mode UI controls ---------- */

  function selectTrack(i) {
    if (mode === "smartBridge") return; // isolation
    const t = tracks?.[i];
    if (!t) return;
    setCurrentIndex(i);
    setCurrentTrack(t);
    setIsPlaying(true);
    try {
      audioRef.current?.play?.();
    } catch {}
  }

  function prevTrack() {
    if (mode === "smartBridge") return;
    if (currentIndex > 0) selectTrack(currentIndex - 1);
  }

  function nextTrack() {
    if (mode === "smartBridge") return;
    if (currentIndex < tracks.length - 1) selectTrack(currentIndex + 1);
  }

  function onSeek(t) {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = t;
    setCurrentTime(t);
  }

  /* ---------- Adaptive Album: queue build ---------- */

  function buildAdaptiveQueue() {
    const songs = Array.isArray(sbSongs) ? sbSongs : [];
    if (songs.length < 1) return [];

    const slots = songs.map((s) => Number(s.slot)).filter((n) => Number.isFinite(n));
    const route = shuffle(slots);

    const bySlot = new Map();
    for (const s of songs) bySlot.set(Number(s.slot), s);

    const q = [];

    // For each hop i->j:
    // - play song i using fromChoice
    // - play bridge i->j
    for (let p = 0; p < route.length - 1; p++) {
      const from = route[p];
      const to = route[p + 1];

      const conn = getConnection(sbConnections, from, to);
      if (!conn?.bridge?.s3Key) return []; // do not invent

      const fromSong = bySlot.get(from);
      const toSong = bySlot.get(to);
      if (!fromSong || !toSong) return [];

      const fromChoice = conn?.fromChoice === "b" ? "b" : "a";
      const toChoice = conn?.toChoice === "b" ? "b" : "a";

      const fromKey = pickSongVariantS3Key(fromSong, fromChoice);
      const bridgeKey = safeString(conn?.bridge?.s3Key);
      if (!fromKey || !bridgeKey) return [];

      q.push({
        type: "song",
        slot: from,
        title: songTitleFromCatalogSong(fromSong),
        s3Key: fromKey,
      });

      q.push({
        type: "bridge",
        fromSlot: from,
        toSlot: to,
        title: "Authored Bridge",
        s3Key: bridgeKey,
      });

      q._lastToChoice = toChoice;
    }

    // Final song uses last hop's toChoice
    const lastSlot = route[route.length - 1];
    const lastSong = bySlot.get(lastSlot);
    if (!lastSong) return [];

    const finalChoice = q._lastToChoice === "b" ? "b" : "a";
    const finalKey = pickSongVariantS3Key(lastSong, finalChoice);
    if (!finalKey) return [];

    q.push({
      type: "song",
      slot: lastSlot,
      title: songTitleFromCatalogSong(lastSong),
      s3Key: finalKey,
    });

    delete q._lastToChoice;
    return q;
  }

  /* ---------- Adaptive Album: Now Playing + highlight rules ---------- */

  function applySongHighlight(slot) {
    setActiveSlot(slot);
    setHighlightVisible(true);

    if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);
    // 100 seconds then fade OFF (soft fade handled by card transition)
    fadeTimerRef.current = window.setTimeout(() => {
      setHighlightVisible(false);
    }, 100 * 1000);
  }

  function onQueueItemEntered(item, nextSongTitleIfKnown = "") {
    clearTimers();
    if (!item) return;

    if (item.type === "song") {
      const slot = Number(item.slot);
      setNowPlayingLabel(item.title || "");
      if (Number.isFinite(slot)) applySongHighlight(slot);
      return;
    }

    // Bridge: no highlight; Now Playing obfuscated with dice delay
    setHighlightVisible(false);
    setActiveSlot(null);

    const entranceMs = randInt(5, 20) * 1000;
    entranceTimerRef.current = window.setTimeout(() => {
      setNowPlayingLabel("Authored Bridge");
    }, entranceMs);

    if (nextSongTitleIfKnown) {
      const exitMs = randInt(5, 20) * 1000;
      exitTimerRef.current = window.setTimeout(() => {
        setNowPlayingLabel(nextSongTitleIfKnown);
      }, exitMs);
    }
  }

  function startAdaptivePlayback() {
    const q = buildAdaptiveQueue();
    if (!q.length) {
      setError("Adaptive Album unavailable for this release.");
      setIsPlaying(false);
      return;
    }

    setError("");
    setSbQueue(q);
    setSbQueueIndex(0);
    setIsPlaying(true);

    const first = q[0];
    const second = q[1];

    if (first?.type === "song") {
      setNowPlayingLabel(first.title || "");
      applySongHighlight(Number(first.slot));
    } else {
      const nextTitle = second?.type === "song" ? second.title : "";
      onQueueItemEntered(first, nextTitle);
    }

    window.setTimeout(() => {
      audioRef.current?.play?.().catch(() => {});
    }, 0);
  }

  /* ---------- player actions ---------- */

  function handlePlay() {
    if (mode === "smartBridge") {
      // New chain if empty or finished
      if (!sbQueue.length || sbQueueIndex >= sbQueue.length) {
        startAdaptivePlayback();
        return;
      }
      setIsPlaying(true);
      window.setTimeout(() => audioRef.current?.play?.().catch(() => {}), 0);
      return;
    }
    setIsPlaying(true);
  }

  function handlePause() {
    setIsPlaying(false);
  }

  function handleModeChange(nextMode) {
    const a = audioRef.current;
    try {
      a?.pause?.();
    } catch {}

    setIsPlaying(false);

    // hard boundary: clear adaptive-only state when leaving/entering
    setSbQueue([]);
    setSbQueueIndex(0);
    setNowPlayingLabel("");
    setActiveSlot(null);
    setHighlightVisible(false);
    clearTimers();

    setMode(nextMode);
  }

  function handleTrackEnd() {
    if (mode !== "smartBridge") {
      setIsPlaying(false);
      return;
    }

    const nextIndex = sbQueueIndex + 1;
    if (nextIndex >= sbQueue.length) {
      setIsPlaying(false);
      setSbQueueIndex(nextIndex);
      setNowPlayingLabel("");
      setActiveSlot(null);
      setHighlightVisible(false);
      clearTimers();
      return;
    }

    setSbQueueIndex(nextIndex);

    const nextItem = sbQueue[nextIndex];
    const afterNext = sbQueue[nextIndex + 1];

    const nextSongTitle =
      nextItem?.type === "bridge" && afterNext?.type === "song"
        ? (afterNext.title || "")
        : "";

    onQueueItemEntered(nextItem, nextSongTitle);

    setIsPlaying(true);
    window.setTimeout(() => audioRef.current?.play?.().catch(() => {}), 0);
  }

  /* ---------- collection UI ---------- */

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
  }, [collectionOpen, collection.map((x) => safeString(x?.shareId)).join("|")]);

  const title = pickTitle(manifest) || "Account";
  const artist = pickArtist(manifest) || "";
  const description = pickDescription(manifest) || "";

  return (
    <div style={{ width: "70%", maxWidth: 1320, margin: "0 auto", padding: "28px 0" }}>
      <audio
        ref={audioRef}
        preload="metadata"
        style={{ display: "none" }}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onEnded={handleTrackEnd}
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

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <Section
            title={title}
            right={<span style={{ opacity: 0.8 }}>{owned ? "Owned" : "Not owned"}</span>}
          >
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
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
              Playlist / Swag / Other are placeholders.
            </div>
          </Section>

          {/* HARD ISOLATION: Adaptive Album card (NO A/B) */}
          {mode === "smartBridge" ? (
            <SmartBridgeCard
              tracks={sbSongs}
              nowPlayingLabel={nowPlayingLabel}
              activeSlot={activeSlot}
              highlightVisible={highlightVisible}
            />
          ) : (
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
          )}
        </div>
      </div>

      {/* PLAYER — BOTTOM ONLY */}
      <div style={{ marginTop: 40 }}>
        <Section>
          <AccountPlayerBar
            audioRef={audioRef}
            currentTrack={mode === "smartBridge" ? sbQueue[sbQueueIndex] : currentTrack}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            onPlay={handlePlay}
            onPause={handlePause}
            onTimeUpdate={(t) => setCurrentTime(t)}
            onDurationChange={(d) => setDuration(d)}
            onSeek={onSeek}
            onTrackEnd={handleTrackEnd}
            onPrev={prevTrack}
            onNext={nextTrack}
            hasPrev={mode === "smartBridge" ? false : currentIndex > 0}
            hasNext={mode === "smartBridge" ? false : currentIndex < tracks.length - 1}
            playbackMode={mode}
            onPlaybackModeChange={handleModeChange}
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
      {(title || right) ? (
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
