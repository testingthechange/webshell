import React, { useEffect, useRef, useState } from "react";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function formatTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

/**
 * Product preview player (/product)
 * - Product-only audio element (data-audio="product")
 * - No Shuffle button
 * - No Repeat button
 * - Optional preview cap (default 40s)
 */
export default function ProductPlayer({
  playbackUrl = "",
  title = "Preview",
  previewSeconds = 40,
}) {
  const audioRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState("");

  const src = playbackUrl || "";

  // Load/replace source
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    setError("");
    setDuration(0);
    setCurrentTime(0);

    if (!src) {
      audio.removeAttribute("src");
      audio.load();
      setIsPlaying(false);
      return;
    }

    audio.src = src;
    audio.load();
  }, [src]);

  // Wire audio events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () =>
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);

    const onTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    const onEnded = () => {
      // Product preview ends = stop (no repeat)
      setIsPlaying(false);
    };

    const onError = () => {
      const mediaErr = audio.error;
      setError(mediaErr ? `Audio error (${mediaErr.code})` : "Audio error");
      setIsPlaying(false);
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, []);

  // Preview cap
  useEffect(() => {
    if (!previewSeconds || previewSeconds <= 0) return;
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      if (audio.currentTime >= previewSeconds) {
        audio.pause();
        audio.currentTime = 0;
      }
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    return () => audio.removeEventListener("timeupdate", onTimeUpdate);
  }, [previewSeconds]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;

    setError("");
    if (!src) return;

    if (audio.paused) {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch((e) => {
          setIsPlaying(false);
          setError(String(e?.message || e));
        });
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }

  function seekByClick(e) {
    const audio = audioRef.current;
    if (!audio) return;

    const cappedDuration =
      previewSeconds && previewSeconds > 0
        ? Math.min(duration || 0, previewSeconds)
        : duration || 0;

    if (!cappedDuration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = clamp(e.clientX - rect.left, 0, rect.width);
    const pct = rect.width ? x / rect.width : 0;

    audio.currentTime = pct * cappedDuration;
  }

  const cappedDuration =
    previewSeconds && previewSeconds > 0
      ? Math.min(duration || 0, previewSeconds)
      : duration || 0;

  const cappedTime =
    previewSeconds && previewSeconds > 0
      ? clamp(currentTime || 0, 0, previewSeconds)
      : currentTime || 0;

  const pct = cappedDuration > 0 ? clamp(cappedTime / cappedDuration, 0, 1) : 0;

  return (
    <div>
      <audio ref={audioRef} data-audio="product" preload="metadata" />

      <div style={{ marginTop: 12, marginBottom: 10, fontWeight: 600 }}>
        {title}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <button
          type="button"
          onClick={togglePlay}
          disabled={!src}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? "❚❚" : "▶"}
        </button>

        <div style={{ marginLeft: "auto", opacity: 0.75, fontVariantNumeric: "tabular-nums" }}>
          {formatTime(cappedTime)} / {formatTime(cappedDuration)}
        </div>
      </div>

      <div
        onClick={seekByClick}
        role="button"
        tabIndex={0}
        style={{
          height: 10,
          borderRadius: 999,
          background: "rgba(255,255,255,0.12)",
          cursor: cappedDuration ? "pointer" : "default",
          position: "relative",
          overflow: "hidden",
          marginBottom: 12,
        }}
      >
        <div
          style={{
            width: `${pct * 100}%`,
            height: "100%",
            background: "rgba(255,255,255,0.7)",
          }}
        />
      </div>

      {error ? <div style={{ marginTop: 10, color: "#b00020" }}>Error: {error}</div> : null}
    </div>
  );
}
