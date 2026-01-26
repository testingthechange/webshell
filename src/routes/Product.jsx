import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ProductPlayerBar from "../components/ProductPlayerBar.jsx";
import { loadManifest } from "../lib/loadManifest.js";

/*
  PRODUCT PAGE — ISOLATED & STRICT
  Column rules:
  - Column 1: cover only
  - Column 2: meta → buy → marketing → tracks
  - Player: bottom only
*/

function Section({ title, children, right }) {
  return (
    <div
      style={{
        padding: 18,
        borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.03)",
      }}
    >
      {title ? (
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>
          {right || null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export default function Product() {
  const { shareId } = useParams();
  const nav = useNavigate();
  const audioRef = useRef(null);

  const API_BASE = useMemo(() => {
    return (
      String(import.meta?.env?.VITE_API_BASE || "").trim().replace(/\/+$/, "") ||
      "https://album-backend-kmuo.onrender.com"
    );
  }, []);

  const [manifest, setManifest] = useState(null);
  const [error, setError] = useState("");

  const [tracks, setTracks] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentTrack, setCurrentTrack] = useState(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const [coverUrl, setCoverUrl] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setError("");
        setManifest(null);
        setTracks([]);
        setCurrentIndex(0);
        setCurrentTrack(null);
        setIsPlaying(false);
        setCoverUrl("");

        if (!shareId) return;

        const m = await loadManifest(shareId);
        if (cancelled) return;

        const list =
          Array.isArray(m?.tracks) ? m.tracks : Array.isArray(m?.album?.tracks) ? m.album.tracks : [];

        setManifest(m);
        setTracks(list);

        if (list.length) {
          setCurrentIndex(0);
          setCurrentTrack(list[0]);
        }
      } catch (e) {
        if (!cancelled) setError(String(e?.message || e));
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [shareId]);

  // Cover: always sign from coverS3Key (previewUrl expires)
  useEffect(() => {
    let cancelled = false;

    async function loadCover() {
      try {
        const s3Key = String(manifest?.coverS3Key || "").trim();
        if (!s3Key) {
          // fallback only if someone provided a stable URL
          const fallback = String(manifest?.coverUrl || "").trim();
          setCoverUrl(fallback);
          return;
        }

        const endpoint = `${API_BASE}/api/playback-url?s3Key=${encodeURIComponent(s3Key)}`;
        const r = await fetch(endpoint, { cache: "no-store" });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j?.ok) throw new Error(j?.error || `COVER_HTTP_${r.status}`);

        const url = String(j?.url || j?.playbackUrl || "").trim();
        if (!url) throw new Error("COVER_URL_MISSING");

        if (!cancelled) setCoverUrl(url);
      } catch {
        // leave blank; UI still works
        if (!cancelled) setCoverUrl("");
      }
    }

    loadCover();
    return () => {
      cancelled = true;
    };
  }, [manifest?.coverS3Key, manifest?.coverUrl, API_BASE]);

  function selectTrack(index) {
    const t = tracks[index];
    if (!t) return;
    setCurrentIndex(index);
    setCurrentTrack(t);
    setIsPlaying(true);
  }

  function prevTrack() {
    if (currentIndex > 0) selectTrack(currentIndex - 1);
  }

  function nextTrack() {
    if (currentIndex < tracks.length - 1) selectTrack(currentIndex + 1);
  }

  function onSeek(t) {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = t;
    setCurrentTime(t);
  }

  function goToCheckout() {
    if (!shareId) return;
    nav(`/checkout/${shareId}`);
  }

  const title = manifest?.title || manifest?.album?.title || "Product";
  const artist = manifest?.artist || manifest?.album?.artist || "";
  const description = manifest?.description || manifest?.album?.description || "";
  const price = manifest?.price || manifest?.product?.price || "";

  return (
    <div style={{ width: "70%", maxWidth: 1320, margin: "0 auto", padding: "28px 0" }}>
      {error ? (
        <Section title="Error">
          <div>{error}</div>
        </Section>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "60% 40%", gap: 32 }}>
        {/* COLUMN ONE — COVER ONLY */}
        <div>
          <div
            style={{
              width: "100%",
              aspectRatio: "1 / 1",
              borderRadius: 24,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            {coverUrl ? (
              <img
                src={coverUrl}
                alt="Cover"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : null}
          </div>
        </div>

        {/* COLUMN TWO — META → BUY → MARKETING → TRACKS */}
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <Section title={title}>
            {artist ? <div style={{ opacity: 0.7 }}>{artist}</div> : null}
            {description ? <div style={{ marginTop: 10, lineHeight: 1.6 }}>{description}</div> : null}
          </Section>

          <Section title="Buy" right={price ? <span>{price}</span> : null}>
            <button
              type="button"
              onClick={goToCheckout}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: 14,
                background: "linear-gradient(180deg, #00d084, #00b36b)",
                color: "#041b12",
                fontWeight: 900,
                border: "none",
                cursor: "pointer",
              }}
            >
              Buy (beta)
            </button>
          </Section>

          <Section title="Why You’ll Love This">
            <div style={{ lineHeight: 1.6 }}>
              Exclusive release. High-quality masters. Seamless playback experience. Support the artist
              directly and unlock the full album.
            </div>
          </Section>

          <Section title="Tracks">
            {tracks.map((t, i) => (
              <button
                key={t?.id || t?.trackId || t?.s3Key || i}
                onClick={() => selectTrack(i)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "12px 14px",
                  marginBottom: 8,
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background:
                    i === currentIndex ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.04)",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                {i + 1}. {t?.title || t?.name || `Track ${i + 1}`}
              </button>
            ))}
          </Section>
        </div>
      </div>

      {/* PLAYER — BOTTOM, SINGLE LOCATION */}
      <div style={{ marginTop: 40 }}>
        <Section>
          <ProductPlayerBar
            audioRef={audioRef}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            playbackMode="preview"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onTimeUpdate={setCurrentTime}
            onDurationChange={setDuration}
            onSeek={onSeek}
            onTrackEnd={() => setIsPlaying(false)}
            onPrev={prevTrack}
            onNext={nextTrack}
            hasPrev={currentIndex > 0}
            hasNext={currentIndex < tracks.length - 1}
          />
        </Section>
      </div>
    </div>
  );
}
