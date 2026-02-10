// src/routes/account/manifestAdapters.js
import { API_BASE } from "./constants.js";
import { safeString } from "./collectionStorage.js";
import loadManifest from "../../lib/loadManifest.js";

async function fetchJson(url) {
  const r = await fetch(url, { cache: "no-store" });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error((j && (j.error || j.message)) || `HTTP ${r.status}`);
  return j;
}

export async function signUrl(s3Key) {
  const key = safeString(s3Key);
  if (!key) return "";
  const j = await fetchJson(`${API_BASE}/api/playback-url?s3Key=${encodeURIComponent(key)}`);
  return safeString(j?.url || j?.playbackUrl || "");
}

export function pickTitle(m) {
  return (
    safeString(m?.title) ||
    safeString(m?.album?.title) ||
    safeString(m?.meta?.albumTitle) ||
    "Untitled"
  );
}

export function pickArtist(m) {
  return (
    safeString(m?.artist) ||
    safeString(m?.album?.artist) ||
    safeString(m?.meta?.artist) ||
    "Unknown artist"
  );
}

export function pickCoverKey(m) {
  return (
    safeString(m?.coverS3Key) ||
    safeString(m?.album?.coverKey) ||
    safeString(m?.coverKey) ||
    safeString(m?.artworkKey) ||
    ""
  );
}

export function pickTracks(m) {
  if (Array.isArray(m?.tracks)) return m.tracks;
  if (Array.isArray(m?.album?.tracks)) return m.album.tracks;
  return [];
}

/**
 * Loads an album by shareId and returns normalized fields.
 */
export async function loadAlbumByShareId(shareId) {
  const id = safeString(shareId);
  if (!id) return null;

  const m = await loadManifest(id);

  const title = pickTitle(m);
  const artist = pickArtist(m);
  const tracks = pickTracks(m);

  const coverKey = pickCoverKey(m);
  const coverUrl = coverKey ? await signUrl(coverKey) : "";

  return { id, title, artist, tracks, coverUrl };
}
