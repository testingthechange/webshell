import { Routes, Route } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import Header from "./components/Header.jsx";
import Home from "./routes/Home.jsx";
import Shop from "./routes/Shop.jsx";
import Product from "./routes/Product.jsx";
import Account from "./routes/Account.jsx";
import PlayerBar from "./components/PlayerBar.jsx";

function safeString(v) {
  return String(v ?? "").trim();
}

async function resolveAudioUrlFromTrack(track) {
  const direct =
    safeString(track?.audioUrl) || safeString(track?.playbackUrl) || safeString(track?.url);

  if (direct) return direct;

  const s3Key = safeString(track?.s3Key);
  const apiBase = safeString(track?.apiBase);
  if (!s3Key || !apiBase) return "";

  const u = new URL(`${apiBase.replace(/\/+$/, "")}/api/playback-url`);
  u.searchParams.set("s3Key", s3Key);

  const r = await fetch(u.toString(), { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.ok !== true) throw new Error(j?.error || `PLAYBACK_URL_HTTP_${r.status}`);

  return safeString(j?.url || j?.playbackUrl);
}

export default function App() {
  const audioRef = useRef(null);

  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackMode, setPlaybackMode] = useState("preview");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const [debug, setDebug] = useState({
    src: "",
    canplay: false,
    playStarted: false,
    playError: "",
    audioErrorCode: "",
    readyState: "",
    networkState: "",
  });

  const snap = (a) => ({
    src: a?.src || "",
    audioErrorCode: a?.error?.code ?? "",
    readyState: a?.readyState ?? "",
    networkState: a?.networkState ?? "",
  });

  const handlePlayTrack = async (track, mode) => {
    setPlaybackMode(mode);
    setCurrentTrack(track);
    setIsPlaying(true);

    const a = audioRef.current;

    setDebug({
      src: "",
      canplay: false,
      playStarted: false,
      playError: "",
      audioErrorCode: "",
      readyState: "",
      networkState: "",
    });

    if (!a) {
      setDebug((d) => ({ ...d, playError: "NO_AUDIO_ELEMENT" }));
      return;
    }

    try {
      setDebug((d) => ({ ...d, src: "(resolving signed url…)" }));

      const src = await resolveAudioUrlFromTrack(track);
      if (!src) {
        setDebug((d) => ({ ...d, playError: "NO_AUDIO_SRC_AFTER_RESOLVE" }));
        return;
      }

      setDebug((d) => ({
        ...d,
        src,
        playError: "",
      }));

      a.pause();
      a.currentTime = 0;
      a.muted = false;
      a.volume = 1;
      a.setAttribute("playsinline", "");

      // IMPORTANT: do NOT set a.crossOrigin here

      a.oncanplay = () => {
        setDebug((d) => ({ ...d, canplay: true, ...snap(a) }));
        a.play()
          .then(() => setDebug((d) => ({ ...d, playStarted: true, ...snap(a) })))
          .catch((e) =>
            setDebug((d) => ({
              ...d,
              playError: String(e?.name || "") + ":" + String(e?.message || e),
              ...snap(a),
            }))
          );
      };

      a.onerror = () => setDebug((d) => ({ ...d, ...snap(a) }));

      a.src = src;
      a.load();
    } catch (e) {
      setDebug((d) => ({
        ...d,
        playError: "EXCEPTION:" + String(e?.message || e),
        ...snap(a),
      }));
    }
  };

  const handlePlay = () => {
    const a = audioRef.current;
    setIsPlaying(true);
    if (a) {
      a.play()
        .then(() => setDebug((d) => ({ ...d, playStarted: true, ...snap(a) })))
        .catch((e) =>
          setDebug((d) => ({
            ...d,
            playError: String(e?.name || "") + ":" + String(e?.message || e),
            ...snap(a),
          }))
        );
    }
  };

  const handlePause = () => {
    const a = audioRef.current;
    setIsPlaying(false);
    if (a) a.pause();
  };

  const handleSeek = (t) => {
    const a = audioRef.current;
    if (a) a.currentTime = t;
    setCurrentTime(t);
  };

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const onTime = () => setCurrentTime(a.currentTime || 0);
    const onDur = () => setDuration(a.duration || 0);

    a.addEventListener("timeupdate", onTime);
    a.addEventListener("durationchange", onDur);

    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("durationchange", onDur);
    };
  }, []);

  return (
    <div className="app-container">
      <Header />

      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />

          <Route
            path="/product/:shareId"
            element={<Product onPlayTrack={(t) => handlePlayTrack(t, "preview")} currentTrack={currentTrack} />}
          />

          <Route
            path="/account/:shareId"
            element={<Account onPlayTrack={(t) => handlePlayTrack(t, "full")} currentTrack={currentTrack} />}
          />

          <Route path="*" element={<Home />} />
        </Routes>

        <div style={{ marginTop: 12, fontFamily: "monospace", fontSize: 12, opacity: 0.85 }}>
          <div>DEBUG src: {debug.src || "—"}</div>
          <div>
            DEBUG canplay: {String(debug.canplay)} | playStarted: {String(debug.playStarted)} | isPlaying:{" "}
            {String(isPlaying)}
          </div>
          <div>
            DEBUG audioErrorCode: {String(debug.audioErrorCode || "—")} | readyState:{" "}
            {String(debug.readyState || "—")} | networkState: {String(debug.networkState || "—")}
          </div>
          <div>DEBUG playError: {debug.playError || "—"}</div>
        </div>
      </main>

      <PlayerBar
        audioRef={audioRef}
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        playbackMode={playbackMode}
        onPlay={handlePlay}
        onPause={handlePause}
        onSeek={handleSeek}
        onTrackEnd={() => setIsPlaying(false)}
      />
    </div>
  );
}
