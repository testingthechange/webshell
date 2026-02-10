// src/routes/account/useAccountState.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  COLLECTION_KEY,
} from "./constants.js";
import {
  safeString,
  loadCollectionRecords,
  ensureShareIdInCollection,
} from "./collectionStorage.js";
import { loadAlbumByShareId } from "./manifestAdapters.js";
import { createAccountPlaybackController } from "./playbackController.js";

export function useAccountState({ nav, routeShareId, audioRef }) {
  const [collection, setCollection] = useState(() => loadCollectionRecords());
  const [activeId, setActiveId] = useState("");

  // active album data
  const [activeTitle, setActiveTitle] = useState("—");
  const [activeArtist, setActiveArtist] = useState("—");
  const [activeCoverUrl, setActiveCoverUrl] = useState("");
  const [tracks, setTracks] = useState([]);

  // player state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // thumbnail cards cache: { [shareId]: { title, artist, coverUrl } }
  const [cards, setCards] = useState({});

  const [err, setErr] = useState("");
  const [loadingActive, setLoadingActive] = useState(false);

  // NAV DROPDOWN (4 tabs)
  const [openTab, setOpenTab] = useState("");

  const thumbIds = useMemo(
    () => collection.map((x) => safeString(x?.shareId)).filter(Boolean),
    [collection]
  );

  // stable getters for controller
  const tracksRef = useRef(tracks);
  const idxRef = useRef(currentIndex);
  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);
  useEffect(() => {
    idxRef.current = currentIndex;
  }, [currentIndex]);

  const playback = useMemo(() => {
    return createAccountPlaybackController({
      audioRef,
      getTracks: () => tracksRef.current || [],
      getCurrentIndex: () => idxRef.current || 0,
      setCurrentIndex,
      setCurrentTrack,
      setIsPlaying,
    });
  }, [audioRef]);

  /* ---------------- collection sync ---------------- */

  useEffect(() => {
    const refresh = () => setCollection(loadCollectionRecords());
    refresh();

    const onStorage = (e) => {
      if (e?.key === COLLECTION_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /**
   * Self-heal: if you arrive at /account/:shareId and that id is not in bb_collection_v1,
   * add it (newest-first) so the thumbnail strip always reflects what you just bought.
   */
  useEffect(() => {
    const id = safeString(routeShareId);
    if (!id) return;
    ensureShareIdInCollection(id);
    setCollection(loadCollectionRecords());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeShareId]);

  /* ---------------- active album selection ---------------- */

  useEffect(() => {
    const first = thumbIds[0] || "";

    if (routeShareId) {
      setActiveId(routeShareId);
      return;
    }

    if (!activeId && first) {
      setActiveId(first);
      return;
    }

    if (activeId && !thumbIds.includes(activeId) && first) {
      setActiveId(first);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeShareId, thumbIds.join("|")]);

  /* ---------------- load active album ---------------- */

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const id = safeString(activeId);

      setErr("");
      setLoadingActive(false);

      setActiveTitle("—");
      setActiveArtist("—");
      setActiveCoverUrl("");
      setTracks([]);
      setCurrentIndex(0);
      setCurrentTrack(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);

      if (!id) return;

      setLoadingActive(true);

      try {
        const a = await loadAlbumByShareId(id);
        if (cancelled) return;
        if (!a) return;

        setActiveTitle(a.title);
        setActiveArtist(a.artist);
        setTracks(a.tracks || []);

        if (a.tracks?.length) {
          setCurrentIndex(0);
          setCurrentTrack(a.tracks[0]);
        }

        setActiveCoverUrl(a.coverUrl || "");

        setCards((prev) => ({
          ...prev,
          [id]: {
            title: a.title,
            artist: a.artist,
            coverUrl: a.coverUrl || prev?.[id]?.coverUrl || "",
          },
        }));
      } catch (e) {
        if (!cancelled) {
          setErr(`Failed to load album for shareId ${id}\n${String(e?.message || e)}`);
        }
      } finally {
        if (!cancelled) setLoadingActive(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeId]);

  /* ---------------- populate thumbnail cards ---------------- */

  useEffect(() => {
    if (!thumbIds.length) return;

    let cancelled = false;

    (async () => {
      const next = {};

      for (const id of thumbIds) {
        const existing = cards[id];
        if (existing?.title && existing?.coverUrl) continue;

        try {
          const a = await loadAlbumByShareId(id);
          if (cancelled) return;
          if (!a) continue;
          next[id] = { title: a.title, artist: a.artist, coverUrl: a.coverUrl || "" };
        } catch {
          if (!existing) next[id] = { title: "Untitled", artist: "Unknown artist", coverUrl: "" };
        }
      }

      if (!cancelled && Object.keys(next).length) {
        setCards((prev) => ({ ...prev, ...next }));
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thumbIds.join("|")]);

  return {
    // collection + cards
    collection,
    cards,
    openTab,
    setOpenTab,

    // active album
    activeId,
    setActiveId,
    activeTitle,
    activeArtist,
    activeCoverUrl,
    tracks,

    // status
    err,
    loadingActive,

    // player state
    currentIndex,
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    setCurrentTime,
    setDuration,
    setIsPlaying,

    // actions
    selectTrack: playback.selectTrack,
    prevTrack: playback.prevTrack,
    nextTrack: playback.nextTrack,
    onTrackEnd: playback.onTrackEnd,
  };
}
