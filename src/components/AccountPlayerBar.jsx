import { useEffect, useRef, useState } from "react";
import { formatDuration } from "../lib/loadManifest.js";

const DEFAULT_API_BASE =
  String(import.meta?.env?.VITE_API_BASE || "").trim().replace(/\/+$/, "") ||
  "https://album-backend-kmuo.onrender.com";

/**
 * AccountPlayerBar (ACCOUNT ONLY)
 * - Own copy of playback logic so Account changes cannot break Product.
 * - Same signed-url + autoplay ordering fix.
 * - No preview cap.
 */
export default function AccountPlayerBar({
  audioRef,
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  playbackMode = "full",
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

        const srcChanged = audio.src !== signedUrl;

        if (srcChanged) {
          audio.src = signedUrl;
          audio.currentTime = 0;
          if (typeof onTimeUpdate === "function") onTimeUpdate(0);
          if (typeof audio.load === "function") audio.load();
        }

        if (isPlaying) {
          audio.play().catch((e) => {
            if (cancelled) return;
            setDebug((d) => ({
              ...d,
              playError: String(e?.name || "") + ":" + String(e?.message || e),
            }));
          });
        }
      } catch (e) {
        if (cancelled) return;
        setDebug((d) => ({ ...d, playError: String(e?.message || e) }));
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.id, currentTrack?.s3Key, isPlaying]);

  useEffect(() => {
    const audio = actualRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      const t = audio.currentTime || 0;
      if (typeof onTimeUpdate === "function") onTimeUpdate(t);
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
  }, [actualRef, onTimeUpdate, onDurationChange, onTrackEnd, onPause]);

  useEffect(() => {
    const audio = actualRef.current;
    if (!audio) return;

    if (!currentTrack) {
      try {
        audio.pause();
      } catch {}
      return;
    }

    if (isPlaying) {
      audio.play().catch((e) => {
        setDebug((d) => ({
          ...d,
          playError: String(e?.name || "") + ":" + String(e?.message || e),
        }));
      });
    } else {
      try {
        audio.pause();
      } catch {}
    }
  }, [isPlaying, currentTrack?.id, actualRef]);

  const maxDuration = duration || 0;
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

        <div style={{ fontSize: 11, opacity: 0.65, marginTop: 6 }} />
      </div>
    </div>
  );
}
