/* ======================================================================
   FILE: src/routes/Product.jsx
   PURPOSE:
   - Two-column Product layout
   - Loads manifest via loadManifest(shareId)
   - Signs cover via /api/playback-url using manifest.coverS3Key
   - PlayerBar bottom only
   ====================================================================== */

import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ProductPlayerBar from "../components/ProductPlayerBar.jsx";
import loadManifest from "../lib/loadManifest.js";

const API_BASE =
  String(import.meta?.env?.VITE_API_BASE || "").trim().replace(/\/+$/, "") ||
  "https://album-backend-kmuo.onrender.com";

/* ---------------- helpers ---------------- */

async function signUrl(s3Key) {
  const key = String(s3Key || "").trim();
  if (!key) return "";
  const r = await fetch(`${API_BASE}/api/playback-url?s3Key=${encodeURIComponent(key)}`, {
    cache: "no-store",
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.ok) return "";
  return String(j?.url || j?.playbackUrl || "");
}

function pickTracks(m) {
  if (!m) return [];
  if (Array.isArray(m?.tracks)) return m.tracks;
  if (Array.isArray(m?.album?.tracks)) return m.album.tracks;
  return [];
}

function Section({ title, children, right }) {
  return (
    <div style={sectionStyle}>
      {title ? (
        <div style={sectionHeader}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>
          {right || null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/* ---------------- component ---------------- */

export default function Product() {
  const { shareId } = useParams();
  const nav = useNavigate();
  const audioRef = useRef(null);

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

    (async () => {
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

        setManifest(m);

        const list = pickTracks(m);
        setTracks(list);

        if (list.length) {
          setCurrentIndex(0);
          setCurrentTrack(list[0]);
        }

        const coverKey = String(m?.coverS3Key || "").trim();
        if (coverKey) {
          const url = await signUrl(coverKey);
          if (!cancelled) setCoverUrl(url || "");
        }
      } catch (e) {
        if (!cancelled) setError(String(e?.message || e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [shareId]);

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
      {error && (
        <Section title="Error">
          <div style={{ opacity: 0.85, whiteSpace: "pre-wrap" }}>{error}</div>
        </Section>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "60% 40%", gap: 32 }}>
        {/* COLUMN ONE — COVER ONLY */}
        <div>
          <div style={coverBox}>
            {coverUrl ? (
              <img
                src={coverUrl}
                alt="Cover"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            ) : (
              <div style={coverPlaceholder}>COVER</div>
            )}
          </div>
        </div>

        {/* COLUMN TWO — META → BUY → MARKETING → TRACKS */}
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <Section title={title}>
            {artist && <div style={{ opacity: 0.7 }}>{artist}</div>}
            {description && <div style={{ marginTop: 10, lineHeight: 1.6 }}>{description}</div>}
          </Section>

          <Section title="Buy" right={price ? <span>{price}</span> : null}>
            <button type="button" onClick={goToCheckout} style={buyBtn}>
              Buy (beta)
            </button>
          </Section>

          <Section title="Why You’ll Love This">
            <div style={{ lineHeight: 1.6 }}>
              Exclusive release. High-quality masters. Seamless playback experience.
              Support the artist directly and unlock the full album.
            </div>
          </Section>

          <Section title="Tracks">
            {tracks.map((t, i) => (
              <button
                key={t?.id || t?.s3Key || i}
                onClick={() => selectTrack(i)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "12px 14px",
                  marginBottom: 8,
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: i === currentIndex ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.04)",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                {i + 1}. {t?.title || t?.name}
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

/* ---------------- styles ---------------- */

const sectionStyle = {
  padding: 18,
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.03)",
};

const sectionHeader = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: 12,
};

const coverBox = {
  width: "100%",
  aspectRatio: "1 / 1",
  borderRadius: 24,
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const coverPlaceholder = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  letterSpacing: 2,
  opacity: 0.55,
  fontSize: 14,
};

const buyBtn = {
  width: "100%",
  padding: "14px",
  borderRadius: 14,
  background: "linear-gradient(180deg, #00d084, #00b36b)",
  color: "#041b12",
  fontWeight: 900,
  border: "none",
  cursor: "pointer",
};
