// FILE: src/components/account/useSmartBridgePlayback.js
// PURPOSE (Account-only, minimal, reliable):
// - ONE <audio> element: songs + bridges (swap src)
// - On SONG ended in smartBridge: play BRIDGE (if exists), then advance to next song
// - End after last song (no loop)
// - Phase only used for UI: "song" | "bridge"

import { useCallback, useEffect, useRef, useState } from "react";
import { adaptEdge } from "../../lib/smart-Bridge/adapter.js";

function safeString(v) {
  return String(v ?? "").trim();
}

function getSlotFromTrack(t, indexFallback) {
  const n = Number(t?.slot);
  if (Number.isFinite(n) && n > 0) return n;
  return Number(indexFallback) + 1;
}

function ensureConn(raw) {
  const c = raw && typeof raw === "object" ? raw : {};
  const bridge = c.bridge && typeof c.bridge === "object" ? c.bridge : {};
  return {
    fromChoice: c.fromChoice === "b" ? "b" : "a",
    toChoice: c.toChoice === "b" ? "b" : "a",
    bridge: {
      s3Key: safeString(bridge.s3Key),
      playbackUrl: safeString(bridge.playbackUrl),
      fileName: safeString(bridge.fileName),
    },
    locked: !!c.locked,
  };
}

export const useSmartBridgePlayback = ({
  audioRef, // ref to the ONE <audio>
  tracks = [],
  connections = {}, // manifest.snapshot.songs.connections (expected keys: "from-to")
  signUrl, // async (s3Key) => signedUrl
  mode, // "album" | "smartBridge"
  isPlaying,
  currentIndex,
  currentTrack,
  setIsPlaying,
  selectTrack, // (index, opts?) => void; opts: { choice, autoplay }
}) => {
  const [phase, setPhase] = useState("song"); // "song" | "bridge"
  const [endedAll, setEndedAll] = useState(false);

  const phaseRef = useRef("song");
  const modeRef = useRef(mode);
  const isPlayingRef = useRef(isPlaying);
  const tracksRef = useRef(tracks);
  const connectionsRef = useRef(connections);
  const indexRef = useRef(currentIndex);
  const trackRef = useRef(currentTrack);

  // Transition bookkeeping (so bridge->next is deterministic)
  const pendingNextRef = useRef({ nextIndex: null, toChoice: "a" });

  // If you want dice delay later, re-enable here. For now: OFF.
  const DICE_DELAY_ENABLED = false;
  const DICE_MIN_MS = 5000;
  const DICE_MAX_MS = 20000;

  const timerRef = useRef(null);

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  useEffect(() => {
    connectionsRef.current = connections;
  }, [connections]);

  useEffect(() => {
    indexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    trackRef.current = currentTrack;
  }, [currentTrack]);

  function setPhaseSafe(p) {
    phaseRef.current = p;
    setPhase(p);
  }

  function nextIndexNoLoop() {
    const n = tracksRef.current?.length || 0;
    if (!n) return null;
    const i = Math.min(Math.max(Number(indexRef.current) || 0, 0), n - 1);
    const ni = i + 1;
    if (ni >= n) return null; // IMPORTANT: no loop
    return ni;
  }

  async function playUrl(url) {
    const a = audioRef?.current;
    if (!a) return false;

    try {
      a.pause?.();
    } catch {}

    try {
      a.currentTime = 0;
    } catch {}

    try {
      if (a.src !== url) {
        a.src = url;
      }
      a.load?.();
    } catch {}

    try {
      await a.play();
      return true;
    } catch {
      return false;
    }
  }

  async function resolveAnyKeyOrUrl(keyOrUrl) {
    const v = safeString(keyOrUrl);
    if (!v) return "";

    // If it looks like an S3 key / storage key, sign it
    if (v.startsWith("storage/") || v.includes("/storage/")) {
      try {
        const url = await signUrl(v);
        return safeString(url);
      } catch {
        return "";
      }
    }

    // Otherwise assume it's already a URL
    return v;
  }

  const handleEnded = useCallback(() => {
    console.log("[SB] handleEnded fired", {
  mode: modeRef.current,
  phase: phaseRef.current,
  isPlaying: isPlayingRef.current,
});

    // Album mode: stop
    if (modeRef.current !== "smartBridge") {
      clearTimer();
      setPhaseSafe("song");
      setEndedAll(false);
      setIsPlaying(false);
      return;
    }

    // If we ended while "bridge", that means bridge finished -> advance to next song
    if (phaseRef.current === "bridge") {
      const { nextIndex, toChoice } = pendingNextRef.current || {};
      pendingNextRef.current = { nextIndex: null, toChoice: "a" };

      setPhaseSafe("song");

      if (nextIndex == null) {
        setEndedAll(true);
        setIsPlaying(false);
        return;
      }

      if (!isPlayingRef.current) return;

      // Advance to next song, using connection's toChoice (A/B)
      selectTrack(nextIndex, { choice: toChoice || "a", autoplay: true });
      return;
    }

    // Otherwise: we ended a SONG -> maybe play bridge, else advance immediately
    const n = tracksRef.current?.length || 0;
    if (!n) {
      setPhaseSafe("song");
      setEndedAll(true);
      setIsPlaying(false);
      return;
    }

    const ni = nextIndexNoLoop();
    if (ni == null) {
      // last song ended => stop
      clearTimer();
      setPhaseSafe("song");
      setEndedAll(true);
      setIsPlaying(false);
      return;
    }

    setEndedAll(false);

    const fromT = trackRef.current || tracksRef.current?.[indexRef.current];
    const toT = tracksRef.current?.[ni];

    const fromSlot = getSlotFromTrack(fromT, indexRef.current);
    const toSlot = getSlotFromTrack(toT, ni);

    // Adapter = single source of truth for bridge existence (by "from-to")
    const abc = adaptEdge(fromSlot, toSlot, tracksRef.current, connectionsRef.current);
    
    const edgeKeyRaw = `${Number(fromSlot)}-${Number(toSlot)}`;
const keys = Object.keys(connectionsRef.current || {});

console.log("[SB] edge check", {
  fromSlot,
  toSlot,
  edgeKeyRaw,
  bridgeKey: abc?.bridgeKey,
  connectionsCount: keys.length,
  sampleKeys: keys.slice(0, 20),
});

    // Still read toChoice from the connection record (manifest reality)
    const edgeKey = abc?.toChoice?.edgeKey || `${Number(fromSlot)}-${Number(toSlot)}`;
    const rawConn = connectionsRef.current?.[edgeKey];
    const c = ensureConn(rawConn);

    const bridgeKeyOrUrl =
      safeString(abc?.bridgeKey) || safeString(c?.bridge?.s3Key) || safeString(c?.bridge?.playbackUrl);

    // --- DEBUG: show why a bridge did/didn't happen ---
    try {
      const keys = Object.keys(connectionsRef.current || {});
      console.log("[SB] ended(song)", {
        mode: modeRef.current,
        phase: phaseRef.current,
        index: indexRef.current,
        nextIndex: ni,
        fromSlot,
        toSlot,
        edgeKey,
        bridgeKey: safeString(abc?.bridgeKey),
        bridgeKeyOrUrl: safeString(bridgeKeyOrUrl),
        connectionsCount: keys.length,
        sampleKeys: keys.slice(0, 20),
      });
    } catch {}
    // --- /DEBUG ---

    const hasBridge = !!safeString(bridgeKeyOrUrl);

    // Keep "playing" through transition
    setIsPlaying(true);

    clearTimer();

    const go = async () => {
      if (modeRef.current !== "smartBridge") return;
      if (!isPlayingRef.current) return;

      if (!hasBridge) {
        // No bridge -> advance directly
        setPhaseSafe("song");
        selectTrack(ni, { choice: c.toChoice || "a", autoplay: true });
        return;
      }

      // Play bridge on SAME audio element
      setPhaseSafe("bridge");

      // --- DEBUG ---
      try {
        console.log("[SB] attempting bridge", { edgeKey, bridgeKeyOrUrl });
      } catch {}
      // --- /DEBUG ---

      const url = await resolveAnyKeyOrUrl(bridgeKeyOrUrl);

      // --- DEBUG ---
      try {
        console.log("[SB] bridge resolved url", { edgeKey, url: safeString(url) });
      } catch {}
      // --- /DEBUG ---

      if (!url) {
        // Can't resolve bridge => fallback
        setPhaseSafe("song");
        selectTrack(ni, { choice: c.toChoice || "a", autoplay: true });
        return;
      }

      // Stash where to go when bridge ends
      pendingNextRef.current = { nextIndex: ni, toChoice: c.toChoice || "a" };

      const ok = await playUrl(url);

      // --- DEBUG ---
      try {
        console.log("[SB] bridge play result", { ok });
      } catch {}
      // --- /DEBUG ---

      if (!ok) {
        // Autoplay blocked or failed => fallback to next song
        pendingNextRef.current = { nextIndex: null, toChoice: "a" };
        setPhaseSafe("song");
        selectTrack(ni, { choice: c.toChoice || "a", autoplay: true });
      }
    };

    const delay = DICE_DELAY_ENABLED
      ? Math.floor(DICE_MIN_MS + Math.random() * (DICE_MAX_MS - DICE_MIN_MS))
      : 0;

    if (delay > 0) {
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        go();
      }, delay);
    } else {
      go();
    }
  }, [audioRef, selectTrack, setIsPlaying, signUrl]);

  // Cancel pending transitions if paused or leaving smartBridge
  useEffect(() => {
    if (mode !== "smartBridge" || !isPlaying) {
      clearTimer();
      pendingNextRef.current = { nextIndex: null, toChoice: "a" };
      setPhaseSafe("song");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, isPlaying]);

  // Cleanup
  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, []);

  return {
    handleEnded,
    phase,
    endedAll,
  };
};
