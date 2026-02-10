import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Fixes:
 * 1) Continuous playback (auto-advance) after preview cap OR natural end.
 * 2) “Click track then have to click Play twice” by supporting external index changes with auto-play,
 *    and by forcing a reliable load()/play() sequence on src changes when we intend to autoplay.
 *
 * Usage options:
 * - Uncontrolled: <ProductPlayer tracks={tracks} />
 * - Controlled selection from parent: <ProductPlayer tracks={tracks} activeIndex={selectedIdx} />
 *   (When activeIndex changes, it will autoplay by default.)
 */
export default function ProductPlayer({
  tracks = [],
  initialIndex = 0,
  activeIndex, // optional: parent-controlled selected track index
  previewSeconds = 40,
  autoPlayOnIndexChange = true,
}) {
  const audioRef = useRef(null);
  const capTimerRef = useRef(null);

  const tracksRef = useRef(tracks);
  const idxRef = useRef(0);

  // When true, the next src load should autoplay (prevents “click twice”)
  const shouldAutoplayRef = useRef(false);

  const clampIndex = (i, len) => {
    if (!len) return 0;
    const n = Number.isFinite(i) ? i : 0;
    return Math.max(0, Math.min(n, len - 1));
  };

  const [idx, setIdx] = useState(() => clampIndex(initialIndex, tracks.length));
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  useEffect(() => {
    idxRef.current = idx;
  }, [idx]);

  // Keep idx valid when tracks length changes
  useEffect(() => {
    setIdx((prev) => clampIndex(prev, tracks.length));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks.length]);

  // Sync from activeIndex (preferred if parent controls selection)
  useEffect(() => {
    if (!Number.isFinite(activeIndex)) return;
    const next = clampIndex(activeIndex, tracks.length);
    setIdx(next);
    if (autoPlayOnIndexChange) {
      shouldAutoplayRef.current = true;
      setIsPlaying(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  // Sync from initialIndex (if used)
  useEffect(() => {
    if (!Number.isFinite(initialIndex)) return;
    const next = clampIndex(initialIndex, tracks.length);
    setIdx(next);
    // do NOT force autoplay from initialIndex by default
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialIndex]);

  const current = tracks[idx] || null;

  const src = useMemo(() => {
    return current?.playbackUrl || current?.url || "";
  }, [current]);

  const clearCap = () => {
    if (capTimerRef.current) {
      window.clearTimeout(capTimerRef.current);
      capTimerRef.current = null;
    }
  };

  const scheduleCap = () => {
    clearCap();
    if (!previewSeconds || previewSeconds <= 0) return;

    capTimerRef.current = window.setTimeout(() => {
      const a = audioRef.current;
      if (!a) return;

      // preview completion behaves like "ended" -> advance
      try {
        a.pause();
      } catch {}
      try {
        a.currentTime = 0;
      } catch {}

      advanceToNext();
    }, previewSeconds * 1000);
  };

  const advanceToNext = () => {
    const list = tracksRef.current || [];
    if (!list.length) return;

    const next = (idxRef.current + 1) % list.length;

    shouldAutoplayRef.current = true;
    setIsPlaying(true);
    setIdx(next);
  };

  const advanceToPrev = () => {
    const list = tracksRef.current || [];
    if (!list.length) return;

    const next = (idxRef.current - 1 + list.length) % list.length;

    shouldAutoplayRef.current = true;
    setIsPlaying(true);
    setIdx(next);
  };

  // Attach audio event listeners ONCE
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const onPlay = () => {
      setIsPlaying(true);
      scheduleCap();
    };

    const onPause = () => {
      setIsPlaying(false);
      clearCap();
    };

    const onEnded = () => {
      clearCap();
      advanceToNext();
    };

    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);

    return () => {
      clearCap();
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load / autoplay on src changes (reliable on Safari/Chrome)
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    clearCap();

    if (!src) {
      try {
        a.pause();
      } catch {}
      return;
    }

    // Set source, force a reload (fixes “sometimes doesn’t start”)
    a.src = src;
    try {
      a.currentTime = 0;
    } catch {}
    try {
      a.load();
    } catch {}

    const tryAutoPlay = () => {
      if (!shouldAutoplayRef.current) return;

      // consume the flag once per src change
      shouldAutoplayRef.current = false;

      // Attempt play; if blocked, user can tap play once
      a.play().catch(() => {});
    };

    // If we intend to autoplay, do it after metadata/canplay for reliability
    const onLoaded = () => tryAutoPlay();
    a.addEventListener("loadedmetadata", onLoaded);
    a.addEventListener("canplay", onLoaded);

    // Also attempt immediately (works in many cases)
    if (isPlaying) {
      shouldAutoplayRef.current = true;
      tryAutoPlay();
    } else {
      tryAutoPlay();
    }

    return () => {
      a.removeEventListener("loadedmetadata", onLoaded);
      a.removeEventListener("canplay", onLoaded);
    };
  }, [src, isPlaying]);

  // If previewSeconds changes while playing, re-arm cap
  useEffect(() => {
    if (!isPlaying) return;
    scheduleCap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewSeconds, isPlaying]);

  const onToggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (!src) return;

    if (a.paused) {
      shouldAutoplayRef.current = true;
      setIsPlaying(true);
      a.play().catch(() => {});
    } else {
      a.pause();
    }
  };

  const onNext = () => advanceToNext();
  const onPrev = () => advanceToPrev();

  return (
    <div>
      <audio ref={audioRef} preload="metadata" />
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button type="button" onClick={onPrev}>
          Prev
        </button>
        <button type="button" onClick={onToggle}>
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button type="button" onClick={onNext}>
          Next
        </button>
        <div style={{ opacity: 0.7 }}>
          {current?.title || `Track ${idx + 1}`} ({idx + 1}/{tracks.length})
        </div>
      </div>
    </div>
  );
}
