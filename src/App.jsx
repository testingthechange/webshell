import { Routes, Route } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import Header from "./components/Header.jsx";
import Home from "./routes/Home.jsx";
import Shop from "./routes/Shop.jsx";
import Product from "./routes/Product.jsx";
import Account from "./routes/Account.jsx";
import PlayerBar from "./components/PlayerBar.jsx";

export default function App() {
  const audioRef = useRef(null);

  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackMode, setPlaybackMode] = useState("preview");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // IMPORTANT:
  // App must NOT set audio.src / load() / play() directly.
  // PlayerBar owns signed-url fetch + setting audio.src + play/pause.

  const handlePlayTrack = (track, mode) => {
    setPlaybackMode(mode || "preview");
    setCurrentTrack(track || null);
    setIsPlaying(true);
  };

  const handlePlay = () => {
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleSeek = (t) => {
    const a = audioRef.current;
    const next = Number(t) || 0;
    if (a) a.currentTime = next;
    setCurrentTime(next);
  };

  // Keep these so UI stays responsive even if audio events lag.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const onTime = () => setCurrentTime(a.currentTime || 0);
    const onDur = () => setDuration(a.duration || 0);

    a.addEventListener("timeupdate", onTime);
    a.addEventListener("durationchange", onDur);
    a.addEventListener("loadedmetadata", onDur);

    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("durationchange", onDur);
      a.removeEventListener("loadedmetadata", onDur);
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
            element={
              <Product
                onPlayTrack={(t) => handlePlayTrack(t, "preview")}
                currentTrack={currentTrack}
              />
            }
          />

          <Route
            path="/account/:shareId"
            element={
              <Account
                onPlayTrack={(t) => handlePlayTrack(t, "full")}
                currentTrack={currentTrack}
              />
            }
          />

          <Route path="*" element={<Home />} />
        </Routes>
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
        onTimeUpdate={setCurrentTime}
        onDurationChange={setDuration}
        onSeek={handleSeek}
        onTrackEnd={() => setIsPlaying(false)}
      />
    </div>
  );
}
