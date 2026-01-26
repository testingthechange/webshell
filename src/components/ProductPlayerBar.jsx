import { useEffect, useRef, useState } from "react";
import { formatDuration } from "../lib/loadManifest.js";

const PREVIEW_CAP_SECONDS = 40;

const DEFAULT_API_BASE =
  String(import.meta?.env?.VITE_API_BASE || "").trim().replace(/\/+$/, "") ||
  "https://album-backend-kmuo.onrender.com";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export default function ProductPlayerBar({
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
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}) {
  const internalAudioRef = useRef(null);
  const actualRef = audioRef || internalAudioRef;

  const [playError, setPlayError] = useState("");

  const maxDuration =
    playbackMode === "preview"
      ? Math.min(duration || PREVIEW_CAP_SECONDS, PREVIEW_CAP_SECONDS)
      : duration || 0;

  const remaining =
    playbackMode === "preview"
      ? Math.max(0, PREVIEW_CAP_SECONDS - currentTime)
      : 0;

  const progressPercent =
    maxDuration > 0 ? clamp((currentTime / maxDuration) * 100, 0, 100) : 0;

  function ensureAudible() {
    const audio = actualRef.current;
    if (!audio) return;
    audio.muted = false;
    audio.volume = 1;
  }

  useEffect(() => {
    ensureAudible();
  }, [actualRef, currentTrack?.id]);

  useEffect(() => {
    const audio = actualRef.current;
    if (!audio) return;

    let cancelled = false;

    (async () => {
      try {
        setPlayError("");

        if (!currentTrack) {
          audio.removeAttribute("src");
          audio.load();
          onPause?.();
          onTimeUpdate?.(0);
          onDurationChange?.(0);
          return;
        }

        const directUrl =
          String(
            currentTrack.playbackUrl ||
              currentTrack.url ||
              currentTrack.audioUrl ||
              currentTrack.src ||
              ""
          ).trim();

        let finalUrl = directUrl;

        if (!finalUrl) {
          const s3Key = String(currentTrack.s3Key || "").trim();
          if (!s3Key) throw new Error("TRACK_MISSING_S3KEY");

          const apiBase = String(currentTrack.apiBase || DEFAULT_API_BASE).replace(/\/+$/, "");
          const endpoint = `${apiBase}/api/playback-url?s3Key=${encodeURIComponent(s3Key)}`;

          const r = await fetch(endpoint, { cache: "no-store" });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(j?.error || `SIGNED_URL_HTTP_${r.status}`);

          finalUrl = String(j?.url || j?.playbackUrl || "").trim();
          if (!finalUrl) throw new Error("SIGNED_URL_MISSING");
        }

        if (cancelled) return;

        if (audio.src !== finalUrl) {
          audio.src = finalUrl;
          audio.currentTime = 0;
          onTimeUpdate?.(0);
          ensureAudible();
          audio.load();
        }
      } catch (e) {
        if (!cancelled) setPlayError(String(e?.message || e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentTrack?.id, currentTrack?.s3Key]);

  useEffect(() => {
    const audio = actualRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
      onDurationChange?.(Number.isFinite(audio.duration) ? audio.duration : 0);
    };

    const onTime = () => {
      const t = audio.currentTime || 0;
      onTimeUpdate?.(t);

      if (playbackMode === "preview" && t >= PREVIEW_CAP_SECONDS) {
        audio.pause();
        audio.currentTime = PREVIEW_CAP_SECONDS;
        onPause?.();
        onTrackEnd?.();
      }
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTime);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTime);
    };
  }, [actualRef, playbackMode]);

  useEffect(() => {
    const audio = actualRef.current;
    if (!audio) return;

    if (!currentTrack) {
      audio.pause();
      return;
    }

    if (isPlaying) {
      ensureAudible();
      audio.play().catch(() => {
        onPause?.();
      });
    } else {
      audio.pause();
    }
  }, [isPlaying, currentTrack?.id]);

  const togglePlayPause = () => {
    if (!currentTrack) return;
    ensureAudible();
    isPlaying ? onPause?.() : onPlay?.();
  };

  const handleProgressClick = (e) => {
    const bar = e.currentTarget;
    const rect = bar.getBoundingClientRect();
    const pct = rect.width ? (e.clientX - rect.left) / rect.width : 0;
    const newTime = clamp(pct, 0, 1) * maxDuration;
    onSeek?.(newTime);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <audio ref={actualRef} preload="metadata" />

      {/* CONTROLS — moved DOWN */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 10,
          marginBottom: 6,   // ↓ brings controls closer to bar
        }}
      >
        <button onClick={onPrev} disabled={!hasPrev} style={smallBtn}>⏮</button>

        <button
          onClick={togglePlayPause}
          style={{
            ...smallBtn,
            width: 46,
            height: 46,
            fontSize: 18,
            background: "rgba(255,255,255,0.10)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.28)",
          }}
        >
          {isPlaying ? "❚❚" : "▶"}
        </button>

        <button onClick={onNext} disabled={!hasNext} style={smallBtn}>⏭</button>
      </div>

      {/* NOW PLAYING */}
      <div style={{ fontSize: 12, marginBottom: 4 }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            opacity: 0.7,
          }}
        >
          Now Playing
        </div>
        <div style={{ fontWeight: 700 }}>
          {currentTrack?.title || currentTrack?.name || "—"}
        </div>
      </div>

      {/* PROGRESS BAR */}
      <div
        onClick={handleProgressClick}
        style={{
          position: "relative",
          height: 10,
          borderRadius: 999,
          background: "rgba(255,255,255,0.12)",
          cursor: "pointer",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            height: "100%",
            width: `${progressPercent}%`,
            background: "rgba(255,255,255,0.60)",
          }}
        />
      </div>

      {/* TIME */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          opacity: 0.85,
          marginTop: 2,
        }}
      >
        <div>
          {formatDuration(currentTime)} / {formatDuration(maxDuration)}
        </div>
        {playbackMode === "preview" && (
          <div>Preview remaining: {formatDuration(remaining)}</div>
        )}
      </div>

      {playError ? (
        <div style={{ fontSize: 12, opacity: 0.7 }}>{playError}</div>
      ) : null}
    </div>
  );
}

const smallBtn = {
  width: 38,
  height: 38,
  borderRadius: "50%",
  border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  fontSize: 14,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
