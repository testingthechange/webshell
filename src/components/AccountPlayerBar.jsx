// src/components/AccountPlayerBar.jsx
import { useEffect, useMemo, useState } from "react";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/**
 * AccountPlayerBar
 * - Bottom player bar UI for Account route
 * - Adds mode switch under the time (right side):
 *   Album (radio), Smart Bridge (radio)
 * - Pulses the active mode indicator
 */
export default function AccountPlayerBar({
  audioRef,
  currentTrack,
  isPlaying,
  currentTime,
  duration,
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

  // NEW (optional)
  playbackMode, // "album" | "smartBridge"
  onPlaybackModeChange,
}) {
  // Back-compat: if parent doesn't pass mode props, manage locally.
  const isControlled =
    typeof playbackMode === "string" && typeof onPlaybackModeChange === "function";
  const [localMode, setLocalMode] = useState("album");

  const mode = isControlled ? playbackMode : localMode;

  const setMode = (next) => {
    if (isControlled) onPlaybackModeChange(next);
    else setLocalMode(next);
  };

  const title = useMemo(() => {
    return currentTrack?.title || currentTrack?.name || "";
  }, [currentTrack]);

  // Wire audio -> parent callbacks (if provided)
  useEffect(() => {
    const a = audioRef?.current;
    if (!a) return;

    const onLoadedMetadata = () => {
      const d = Number.isFinite(a.duration) ? a.duration : 0;
      onDurationChange?.(d);
    };

    const onTime = () => {
      onTimeUpdate?.(a.currentTime || 0);
    };

    const onEndedLocal = () => {
      onTrackEnd?.();
    };

    a.addEventListener("loadedmetadata", onLoadedMetadata);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEndedLocal);

    return () => {
      a.removeEventListener("loadedmetadata", onLoadedMetadata);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEndedLocal);
    };
  }, [audioRef, onDurationChange, onTimeUpdate, onTrackEnd]);

  function togglePlay() {
    const a = audioRef?.current;
    if (!a) return;

    if (a.paused) {
      onPlay?.();
      a.play?.().catch(() => {});
    } else {
      onPause?.();
      a.pause?.();
    }
  }

  function seekByClick(e) {
    const a = audioRef?.current;
    if (!a || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = clamp(e.clientX - rect.left, 0, rect.width);
    const pct = rect.width ? x / rect.width : 0;
    const t = pct * duration;

    a.currentTime = t;
    onSeek?.(t);
  }

  const pct = duration > 0 ? clamp((currentTime || 0) / duration, 0, 1) : 0;

  // Match your current UI style: show raw seconds as "0 / 131"
  const leftTime = Math.floor(currentTime || 0);
  const rightTime = Math.floor(duration || 0);

  return (
    <div style={wrap}>
      <style>{`
        @keyframes modePulse {
          0% { transform: scale(1); opacity: 0.85; }
          50% { transform: scale(1.25); opacity: 1; }
          100% { transform: scale(1); opacity: 0.85; }
        }
      `}</style>

      <div style={bar}>
        <div style={row}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button type="button" onClick={onPrev} disabled={!hasPrev} style={btn}>
              Prev
            </button>

            <button type="button" onClick={togglePlay} style={btn}>
              {isPlaying ? "Pause" : "Play"}
            </button>

            <button type="button" onClick={onNext} disabled={!hasNext} style={btn}>
              Next
            </button>
          </div>

          {/* Right side: time + mode switch under time */}
          <div style={right}>
            <div style={timeText}>
              {leftTime} / {rightTime}
            </div>

            <div style={modes}>
              <label style={modeLabel} onClick={() => setMode("album")}>
                <span
                  aria-hidden="true"
                  style={{
                    ...dot,
                    background: mode === "album" ? "rgba(255,255,255,0.95)" : "transparent",
                    animation: mode === "album" ? "modePulse 1.1s ease-in-out infinite" : "none",
                  }}
                />
                <input
                  type="radio"
                  name="accountPlaybackMode"
                  value="album"
                  checked={mode === "album"}
                  onChange={() => setMode("album")}
                  style={{ display: "none" }}
                />
                <span style={modeText}>Album</span>
              </label>

              <label style={modeLabel} onClick={() => setMode("smartBridge")}>
                <span
                  aria-hidden="true"
                  style={{
                    ...dot,
                    background: mode === "smartBridge" ? "rgba(255,255,255,0.95)" : "transparent",
                    animation:
                      mode === "smartBridge" ? "modePulse 1.1s ease-in-out infinite" : "none",
                  }}
                />
                <input
                  type="radio"
                  name="accountPlaybackMode"
                  value="smartBridge"
                  checked={mode === "smartBridge"}
                  onChange={() => setMode("smartBridge")}
                  style={{ display: "none" }}
                />
                <span style={modeText}>Smart Bridge</span>
              </label>
            </div>
          </div>
        </div>

        <div
          onClick={seekByClick}
          role="button"
          tabIndex={0}
          style={seek}
          aria-label="Seek"
        >
          <div style={{ ...seekFill, width: `${pct * 100}%` }} />
        </div>

        {title ? <div style={trackTitle}>{title}</div> : null}
      </div>
    </div>
  );
}

/* ---------------- styles ---------------- */

const wrap = {
  width: "100%",
};

const bar = {
  width: "100%",
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  padding: 14,
};

const row = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 10,
};

const btn = {
  padding: "8px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.10)",
  color: "inherit",
  cursor: "pointer",
};

const right = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: 6,
  minWidth: 160,
};

const timeText = {
  opacity: 0.85,
  fontVariantNumeric: "tabular-nums",
};

const modes = {
  display: "flex",
  gap: 12,
  alignItems: "center",
};

const modeLabel = {
  display: "flex",
  gap: 6,
  alignItems: "center",
  cursor: "pointer",
  userSelect: "none",
};

const dot = {
  width: 10,
  height: 10,
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.55)",
};

const modeText = {
  fontSize: 12,
  opacity: 0.85,
};

const seek = {
  height: 10,
  borderRadius: 999,
  background: "rgba(255,255,255,0.12)",
  cursor: "pointer",
  position: "relative",
  overflow: "hidden",
};

const seekFill = {
  height: "100%",
  background: "rgba(255,255,255,0.7)",
};

const trackTitle = {
  marginTop: 10,
  opacity: 0.85,
  fontSize: 12,
};
