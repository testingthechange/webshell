import { useEffect, useRef, useState } from "react";
import { formatDuration } from "../lib/loadManifest.js";

const PREVIEW_CAP_SECONDS = 40;

const DEFAULT_API_BASE =
  String(import.meta?.env?.VITE_API_BASE || "").trim().replace(/\/+$/, "") ||
  "https://album-backend-kmuo.onrender.com";

export default function PlayerBar({
  audioRef,
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  playbackMode,
  onPlay,
  onPause,
  onTimeUpdate,
  onDurationChange,
  onSeek,
  onTrackEnd,
}) {
  const internalAudioRef = useRef(null);
  const actualRef = audioRef || internalAudioRef;

  const [debug, setDebug] = useState({
    lastS3Key: "",
    playError: "",
  });

  // Only PlayerBar should ever touch <audio>. App controls state only.
  // Track change -> fetch signed url -> set audio.src (do NOT call pause here)
  useEffect(() => {
    const audio = actualRef.current;
    if (!audio || !currentTrack) return;

    let cancelled = false;

    (async () => {
      try {
        const s3Key = String(currentTrack.s3Key || "").trim();
        if (!s3Key) throw new Error("TRACK_MISSING_S3KEY");

        setDebug((d) => ({ ...d, lastS3Key: s3Key, playError: "" }));

        const apiBase = String(currentTrack.apiBase || DEFAULT_API_BASE).replace(/\/+$/, "");
        const endpoint = `${apiBase}/api/playback-url?s3Key=${encodeURIComponent(s3Key)}`;

        const r = await fetch(endpoint, { cache: "no-store" });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error || `SIGNED_URL_HTTP_${r.status}`);

        const signedUrl = String(j?.url || j?.playbackUrl || "").trim();
        if (!signedUrl) throw new Error("SIGNED_URL_MISSING");

        if (cancelled) return;

        // Setting src + load is fine. Do NOT call pause() here.
        // Autoplay is handled by the isPlaying effect below.
        if (audio.src !== signedUrl) {
          audio.src = signedUrl;
          audio.currentTime = 0;
          if (typeof onTimeUpdate === "function") onTimeUpdate(0);
          if (typeof audio.load === "function") audio.load();
        }
      } catch (e) {
        if (cancelled) return;
        setDebug((d) => ({ ...d, playError: String(e?.message || e) }));
        // IMPORTANT: do NOT call audio.pause() here (this is what causes the play/pause race)
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.id, currentTrack?.s3Key]);

  // Audio event wiring
  useEffect(() => {
    const audio = actualRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      const t = audio.currentTime || 0;
      if (typeof onTimeUpdate === "function") onTimeUpdate(t);

      if (playbackMode === "preview" && t >= PREVIEW_CAP_SECONDS) {
        // Preview cap is the ONLY automatic pause path.
        try {
          audio.pause();
        } catch {}
        if (typeof onPause === "function") onPause(); // keep UI state consistent
        if (typeof onTrackEnd === "function") onTrackEnd();
      }
    };

    const handleLoadedMetadata = () => {
      if (typeof onDurationChange === "function") onDurationChange(audio.duration || 0);
    };

    const handleEnded = () => {
      if (typeof onPause === "function") onPause();
      if (typeof onTrackEnd === "function") onTrackEnd();
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [actualRef, playbackMode, onTimeUpdate, onDurationChange, onTrackEnd, onPause]);

  // Single authoritative play/pause effect.
  // This avoids "play() interrupted by pause()" by ensuring pause only happens
  // when isPlaying flips false (or preview cap / ended handlers).
  useEffect(() => {
    const audio = actualRef.current;
    if (!audio) return;

    if (!currentTrack) {
      // No track: keep quiet, but don't race.
      try {
        audio.pause();
      } catch {}
      return;
    }

    if (isPlaying) {
      // If src isn't ready yet, this might reject; that's OK.
      audio.play().catch((e) => {
        setDebug((d) => ({ ...d, playError: String(e?.name || "") + ":" + String(e?.message || e) }));
      });
    } else {
      try {
        audio.pause();
      } catch {}
    }
  }, [isPlaying, currentTrack?.id, actualRef]);

  const maxDuration =
    playbackMode === "preview"
      ? Math.min(duration || PREVIEW_CAP_SECONDS, PREVIEW_CAP_SECONDS)
      : duration || 0;

  const progressPercent = maxDuration > 0 ? (currentTime / maxDuration) * 100 : 0;

  const handleProgressClick = (e) => {
    const bar = e.currentTarget;
    const rect = bar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * maxDuration;
    if (typeof onSeek === "function") onSeek(newTime);
  };

  const togglePlayPause = () => {
    if (!currentTrack) return;
    if (isPlaying) {
      if (typeof onPause === "function") onPause();
    } else {
      if (typeof onPlay === "function") onPlay();
    }
  };

  return (
    <div className="player-bar">
      <audio ref={actualRef} preload="metadata" />

      <div className="player-controls">
        <button
          className="player-btn player-btn-play"
          onClick={togglePlayPause}
          disabled={!currentTrack}
        >
          {isPlaying ? "❚❚" : "▶"}
        </button>
      </div>

      <div className="player-progress">
        <div className="player-progress-bar" onClick={handleProgressClick}>
          <div
            className="player-progress-fill"
            style={{ width: `${Math.min(progressPercent, 100)}%` }}
          />
        </div>

        <span className="player-track-name">
          {currentTrack?.title || currentTrack?.name || "—"}
        </span>

        <span className="player-time">
          {formatDuration(currentTime)} / {formatDuration(maxDuration)}
        </span>

        <div style={{ fontSize: 11, opacity: 0.65, marginTop: 6 }}>
          <div>DEBUG s3Key: {debug.lastS3Key || "—"}</div>
          <div>DEBUG playError: {debug.playError || "—"}</div>
        </div>
      </div>
    </div>
  );
}
