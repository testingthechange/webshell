import { useEffect, useMemo, useRef, useState } from "react";

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

function getTrackSrc(t) {
  return t?.playbackUrl || t?.url || t?.audioUrl || t?.src || "";
}

/**
 * Account player (minimal)
 * - No Repeat / Shuffle
 * - Click track = plays immediately (one click)
 * - Own audio element (data-audio="account")
 */
export default function AccountPlayer({ tracks = [], initialIndex = 0 }) {
  const audioRef = useRef(null);

  const safeTracks = useMemo(() => (Array.isArray(tracks) ? tracks : []), [tracks]);
  const [index, setIndex] = useState(
    clamp(initialIndex, 0, Math.max(0, safeTracks.length - 1))
  );

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState("");

  const activeTrack = safeTracks[index] || null;
  const activeSrc = getTrackSrc(activeTrack);
  const title = activeTrack?.title || activeTrack?.name || `Track ${index + 1}`;

  // Keep index valid if tracks change.
  useEffect(() => {
    setIndex((i) => clamp(i, 0, Math.max(0, safeTracks.length - 1)));
  }, [safeTracks.length]);

  // Wire audio events.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () =>
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

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

  function hardPlay(src) {
    const audio = audioRef.current;
    if (!audio) return;

    setError("");

    if (!src) {
      audio.pause();
      audio.removeAttribute("src");
      setIsPlaying(false);
      return;
    }

    // Do NOT call audio.load() here; it can interrupt play() and cause the "needs 2 clicks" symptom.
    // Set src + play inside the same user gesture.
    audio.pause();
    audio.currentTime = 0;

    if (audio.src !== src) {
      audio.src = src;
    }

    // Set intent immediately; UI should reflect user action
    setIsPlaying(true);

    audio.play().catch((e) => {
      setIsPlaying(false);
      setError(String(e?.message || e));
    });
  }

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;

    setError("");

    if (audio.paused) {
      if (!audio.src && activeSrc) {
        hardPlay(activeSrc);
        return;
      }
      audio.play().catch((e) => {
        setIsPlaying(false);
        setError(String(e?.message || e));
      });
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }

  function prev() {
    if (safeTracks.length === 0) return;
    const nextIndex = clamp(index - 1, 0, Math.max(0, safeTracks.length - 1));
    const nextSrc = getTrackSrc(safeTracks[nextIndex]);
    hardPlay(nextSrc);
    setIndex(nextIndex);
  }

  function next() {
    if (safeTracks.length === 0) return;
    const nextIndex = clamp(index + 1, 0, Math.max(0, safeTracks.length - 1));
    const nextSrc = getTrackSrc(safeTracks[nextIndex]);
    hardPlay(nextSrc);
    setIndex(nextIndex);
  }

  function seekByClick(e) {
    const audio = audioRef.current;
    if (!audio || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = clamp(e.clientX - rect.left, 0, rect.width);
    const pct = rect.width ? x / rect.width : 0;
    audio.currentTime = pct * duration;
  }

  const pct = duration > 0 ? clamp(currentTime / duration, 0, 1) : 0;

  return (
    <div>
      <audio ref={audioRef} data-audio="account" preload="metadata" />

      <div style={{ marginTop: 12, marginBottom: 10, fontWeight: 600 }}>
        {title}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <button type="button" onClick={prev} disabled={index <= 0} aria-label="Previous">
          ◀◀
        </button>

        <button
          type="button"
          onClick={togglePlay}
          disabled={!activeSrc}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? "❚❚" : "▶"}
        </button>

        <button
          type="button"
          onClick={next}
          disabled={index >= safeTracks.length - 1}
          aria-label="Next"
        >
          ▶▶
        </button>

        <div style={{ marginLeft: "auto", opacity: 0.75, fontVariantNumeric: "tabular-nums" }}>
          {formatTime(currentTime)} / {formatTime(duration)}
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
          cursor: duration ? "pointer" : "default",
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

      {safeTracks.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {safeTracks.map((t, i) => {
            const label = t?.title || t?.name || `Track ${i + 1}`;
            const active = i === index;
            const nextSrc = getTrackSrc(t);

            return (
              <button
                key={t?.id || t?.trackId || `${label}-${i}`}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();

                  // Play first (user gesture), then update UI selection.
                  hardPlay(nextSrc);
                  setIndex(i);
                }}
                style={{
                  textAlign: "left",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: active ? "rgba(255,255,255,0.10)" : "transparent",
                  color: "inherit",
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

      {error ? <div style={{ marginTop: 10, color: "#b00020" }}>Error: {error}</div> : null}
    </div>
  );
}
