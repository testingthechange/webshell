// src/lib/loadManifest.js
//
// Loads publish JSON and normalizes to:
// { title, artist, coverUrl, tracks: [{ id, title, s3Key, fileName, apiBase }] }
//
// New model:
// - Published manifests contain s3Key (not playbackUrl).
// - Player must call /api/playback-url?s3Key=... to get a fresh signed URL.

const DEFAULT_API_BASE =
  String(import.meta?.env?.VITE_API_BASE || "").trim().replace(/\/+$/, "") ||
  "https://album-backend-kmuo.onrender.com";

const PUBLISH_BASE = `${DEFAULT_API_BASE}/publish`;

// Legacy keys (optional)
const LEGACY_PROJECT_KEY_TO_URL = {
  project716944: `${PUBLISH_BASE}/f6692a3b94aad73430ed55a6.json`,
  project210731: `${PUBLISH_BASE}/a01cba9d77b073968a39219b.json`,
};

function isHttpUrl(s) {
  return /^https?:\/\//i.test(String(s || ""));
}

function isShareId24Hex(s) {
  return /^[a-f0-9]{24}$/i.test(String(s || "").trim());
}

function resolveManifestUrl(keyOrUrl) {
  const v = String(keyOrUrl || "").trim();
  if (!v) throw new Error("MISSING_PROJECT_KEY");

  if (isHttpUrl(v)) return v;
  if (LEGACY_PROJECT_KEY_TO_URL[v]) return LEGACY_PROJECT_KEY_TO_URL[v];
  if (isShareId24Hex(v)) return `${PUBLISH_BASE}/${v}.json`;

  throw new Error(`UNKNOWN_PROJECT_KEY:${v}`);
}

async function fetchJson(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`MANIFEST_HTTP_${r.status}`);
  return r.json();
}

export async function loadManifest(projectKeyOrShareIdOrUrl) {
  const url = resolveManifestUrl(projectKeyOrShareIdOrUrl);
  const json = await fetchJson(url);

  // publish endpoint returns: { shareId, projectId, snapshotKey, createdAt, snapshot: { ... } }
  const snap =
    json && typeof json === "object" && json.snapshot && typeof json.snapshot === "object"
      ? json.snapshot
      : json;

  // IMPORTANT:
  // our snapshots can be either:
  //  A) project object directly (catalog/album/etc at root), OR
  //  B) wrapper with { project: {...}, locked: {...} } (from earlier pipeline)
  const projectLike =
    snap && typeof snap === "object" && snap.project && typeof snap.project === "object" ? snap.project : snap;

  return normalizeSnapshot(projectLike, url);
}

function normalizeSnapshot(projectLike, sourceUrl = "") {
  const title =
    safeString(projectLike?.album?.title) ||
    safeString(projectLike?.albumTitle) ||
    safeString(projectLike?.projectName) ||
    "";

  const artist =
    safeString(projectLike?.album?.artist) ||
    safeString(projectLike?.albumArtist) ||
    safeString(projectLike?.performerName) ||
    safeString(projectLike?.company) ||
    "";

  const coverUrl =
    safeString(projectLike?.album?.coverUrl) ||
    safeString(projectLike?.coverUrl) ||
    safeString(projectLike?.cover) ||
    safeString(projectLike?.artworkUrl) ||
    "";

  const tracks = extractTracks(projectLike);

  return {
    sourceUrl,
    apiBase: DEFAULT_API_BASE,
    title,
    artist,
    coverUrl,
    tracks,
  };
}

function extractTracks(projectLike) {
  const songs = projectLike?.catalog?.songs;

  if (Array.isArray(songs)) {
    const out = [];
    for (const s of songs) {
      const slot = s?.slot;
      const title =
        safeString(s?.title) ||
        safeString(s?.titleJson?.title) ||
        (slot ? `Track ${slot}` : "Track");

      const fileName = safeString(s?.files?.album?.fileName || "");
      const s3Key = safeString(s?.files?.album?.s3Key || "");

      if (s3Key) {
        out.push({
          id: slot != null ? String(slot) : String(out.length + 1),
          title,
          s3Key,
          fileName,
          apiBase: DEFAULT_API_BASE,
        });
      }
    }
    return out;
  }

  // fallback: legacy flat manifests
  if (Array.isArray(projectLike?.tracks)) {
    return projectLike.tracks
      .map((t, i) => ({
        id: safeString(t?.id) || String(i),
        title: safeString(t?.title) || safeString(t?.name) || `Track ${i + 1}`,
        s3Key: safeString(t?.s3Key || ""),
        fileName: safeString(t?.fileName || ""),
        apiBase: DEFAULT_API_BASE,
      }))
      .filter((t) => t.s3Key);
  }

  return [];
}

function safeString(v) {
  return String(v ?? "").trim();
}

export function formatDuration(seconds) {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s < 0) return "--:--";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}
