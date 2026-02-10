// src/components/ProductPlayerBar.jsx
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
  playbackMode, // "preview" | "full"
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

  // Keep latest callbacks + playing state stable for event listeners
  const cbRef = useRef({
    onPlay: null,
    onPause: null,
    onTimeUpdate: null,
    onDurationChange: null,
    onTrackEnd: null,
  });
  const playRef = useRef(false);

  useEffect(() => {
    cbRef.current.onPlay = onPlay;
    cbRef.current.onPause = onPause;
    cbRef.current.onTimeUpdate = onTimeUpdate;
    cbRef.current.onDurationChange = onDurationChange;
    cbRef.current.onTrackEnd = onTrackEnd;
    playRef.current = !!isPlaying;
  });

  // HARD GUARD: allow only ONE end-signal per track, with cooldown
  const endFiredRef = useRef(false);
  const lastTrackKeyRef = useRef("");
  const lastEndAtRef = useRef(0);

  // AUTOPLAY GUARD: ensure the newly-loaded track actually starts playing
  const autoplayTokenRef = useRef(0);

  const trackKey = String(
    currentTrack?.id || currentTrack?.s3Key || currentTrack?.playbackUrl || currentTrack?.url || ""
  );

  useEffect(() => {
    // reset end guard when track changes
    if (trackKey && trackKey !== lastTrackKeyRef.current) {
      lastTrackKeyRef.current = trackKey;
      endFiredRef.current = false;
    }
  }, [trackKey]);

  const fireTrackEndOnce = () => {
    const now = Date.now();
    if (endFiredRef.current) return;
    if (now - lastEndAtRef.current < 350) return; // cooldown prevents rapid cascades
    endFiredRef.current = true;
    lastEndAtRef.current = now;
    cbRef.current.onTrackEnd?.();
  };

  const maxDuration =
    playbackMode === "preview"
      ? Math.min(duration || PREVIEW_CAP_SECONDS, PREVIEW_CAP_SECONDS)
      : duration || 0;

  const remaining =
    playbackMode === "preview" ? Math.max(0, PREVIEW_CAP_SECONDS - currentTime) : 0;

  const progressPercent = maxDuration > 0 ? clamp((currentTime / maxDuration) * 100, 0, 100) : 0;

  function ensureAudible() {
    const audio = actualRef.current;
    if (!audio) return;
    audio.muted = false;
    audio.volume = 1;
  }

  // Resolve playable URL when track changes
  useEffect(() => {
    const audio = actualRef.current;
    if (!audio) return;

    let cancelled = false;

    const tryAutoPlayForThisLoad = () => {
      // only autoplay if parent says we are playing
      if (!playRef.current) return;

      const token = ++autoplayTokenRef.current;

      const attempt = () => {
        // ignore if a newer load happened
        if (token !== autoplayTokenRef.current) return;
        ensureAudible();
        audio.play().catch(() => {
          // if blocked, do not spam; user can press play once
        });
      };

      // best effort: immediately + once canplay fires
      window.setTimeout(attempt, 0);

      const onCanPlay = () => {
        audio.removeEventListener("canplay", onCanPlay);
        audio.removeEventListener("loadedmetadata", onCanPlay);
        attempt();
      };

      audio.addEventListener("canplay", onCanPlay);
      audio.addEventListener("loadedmetadata", onCanPlay);
    };

    (async () => {
      try {
        setPlayError("");

        if (!currentTrack) {
          try {
            audio.pause();
          } catch {}
          audio.removeAttribute("src");
          audio.load();
          cbRef.current.onPause?.();
          cbRef.current.onTimeUpdate?.(0);
          cbRef.current.onDurationChange?.(0);
          return;
        }

        const directUrl = String(
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

        // Swap source safely
        if (audio.src !== finalUrl) {
          try {
            audio.pause();
          } catch {}

          try {
            audio.currentTime = 0;
          } catch {}

          cbRef.current.onTimeUpdate?.(0);
          ensureAudible();

          audio.src = finalUrl;
          audio.load();

          // ✅ critical: after changing src due to auto-advance, actually start the next track
          tryAutoPlayForThisLoad();
        } else {
          // If src didn't change but we're supposed to be playing, ensure it's playing
          tryAutoPlayForThisLoad();
        }
      } catch (e) {
        if (!cancelled) setPlayError(String(e?.message || e));
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.id, currentTrack?.s3Key, currentTrack?.playbackUrl, currentTrack?.url]);

  // Attach audio listeners ONCE (uses refs to stay current)
  useEffect(() => {
    const audio = actualRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
      cbRef.current.onDurationChange?.(Number.isFinite(audio.duration) ? audio.duration : 0);
    };

    const onTime = () => {
      const t = audio.currentTime || 0;
      cbRef.current.onTimeUpdate?.(t);

      // PREVIEW CAP: only while actively playing; fire once
      if (playbackMode === "preview" && playRef.current) {
        if (t >= PREVIEW_CAP_SECONDS - 0.05) {
          try {
            audio.pause();
          } catch {}
          try {
            audio.currentTime = 0;
          } catch {}
          cbRef.current.onTimeUpdate?.(0);
          fireTrackEndOnce();
        }
      }
    };

    const onEnded = () => {
      // Natural end: ignore “ended” that fires immediately during src swaps
      if (!playRef.current) return;
      if ((audio.currentTime || 0) < 0.25) return;
      fireTrackEndOnce();
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actualRef, playbackMode]);

  // Drive actual play/pause from isPlaying
  useEffect(() => {
    const audio = actualRef.current;
    if (!audio) return;

    ensureAudible();

    if (!currentTrack) {
      try {
        audio.pause();
      } catch {}
      return;
    }

    if (isPlaying) {
      audio.play().catch(() => {
        cbRef.current.onPause?.();
      });
    } else {
      audio.pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, currentTrack?.id, currentTrack?.s3Key]);

  const togglePlayPause = () => {
    if (!currentTrack) return;
    ensureAudible();
    isPlaying ? cbRef.current.onPause?.() : cbRef.current.onPlay?.();
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

      {/* CONTROLS (NO REPEAT / SHUFFLE) */}
      <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 6 }}>
        <button onClick={onPrev} disabled={!hasPrev} style={smallBtn}>
          ⏮
        </button>

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

        <button onClick={onNext} disabled={!hasNext} style={smallBtn}>
          ⏭
        </button>
      </div>

      {/* NOW PLAYING */}
      <div style={{ fontSize: 12, marginBottom: 4 }}>
        <div style={{ fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", opacity: 0.7 }}>
          Now Playing
        </div>
        <div style={{ fontWeight: 700 }}>{currentTrack?.title || currentTrack?.name || "—"}</div>
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
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.85, marginTop: 2 }}>
        <div>
          {formatDuration(currentTime)} / {formatDuration(maxDuration)}
        </div>
        {playbackMode === "preview" ? <div>Preview remaining: {formatDuration(remaining)}</div> : <div />}
      </div>

      {playError ? <div style={{ fontSize: 12, opacity: 0.7 }}>{playError}</div> : null}
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
