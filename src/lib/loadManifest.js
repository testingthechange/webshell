const DEFAULT_API_BASE =
  String(import.meta?.env?.VITE_API_BASE || "").trim().replace(/\/+$/, "") ||
  "https://album-backend-kmuo.onrender.com";

export function formatDuration(sec) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function safe(v) {
  return String(v ?? "").trim();
}

function pickRaw(obj, path) {
  const parts = path.split(".");
  let cur = obj;
  for (const k of parts) {
    if (cur && typeof cur === "object" && k in cur) cur = cur[k];
    else return undefined;
  }
  return cur;
}

function pick(obj, paths, fallback = "") {
  for (const p of paths) {
    const v = pickRaw(obj, p);
    const s = safe(v);
    if (s) return s;
  }
  return fallback;
}

function normalizePublishedSnapshotToManifest(published) {
  const snap = published?.snapshot || null;
  if (!snap) return null;

  const title = pick(
    snap,
    ["album.masterSave.meta.albumTitle", "album.meta.albumTitle", "projectName"],
    "Album"
  );

  const artist = pick(
    snap,
    ["album.masterSave.meta.artistName", "album.meta.artistName", "company"],
    ""
  );

  // IMPORTANT: do NOT use previewUrl at runtime (it expires). Use s3Key + backend signing.
  const coverS3Key = pick(
    snap,
    ["album.masterSave.cover.s3Key", "album.cover.s3Key"],
    ""
  );

  const songs = Array.isArray(snap?.catalog?.songs) ? snap.catalog.songs : [];

  const order =
    Array.isArray(snap?.album?.masterSave?.playlistOrder) &&
    snap.album.masterSave.playlistOrder.length
      ? snap.album.masterSave.playlistOrder
      : songs.map((s) => s?.slot).filter(Boolean);

  const bySlot = new Map();
  for (const s of songs) {
    const slot = Number(s?.slot);
    if (!Number.isFinite(slot)) continue;
    bySlot.set(slot, s);
  }

  const tracks = [];
  for (const slot of order) {
    const s = bySlot.get(Number(slot));
    if (!s) continue;

    const tTitle = safe(s?.title) || safe(s?.titleJson?.title) || `Track ${slot}`;
    const s3Key = safe(s?.files?.album?.s3Key);
    if (!s3Key) continue;

    tracks.push({
      id: `${safe(published?.shareId) || "share"}-${slot}`,
      slot,
      title: tTitle,
      name: tTitle,
      s3Key,
      apiBase: DEFAULT_API_BASE,
    });
  }

  return {
    shareId: safe(published?.shareId),
    projectId: safe(published?.projectId || snap?.projectId),
    title,
    name: title,
    artist,
    description: pick(snap, ["album.meta.description", "album.masterSave.meta.description"], ""),
    // leave coverUrl blank on purpose (avoid expired signed urls)
    coverUrl: "",
    coverS3Key,
    tracks,
    apiBase: DEFAULT_API_BASE,
    snapshotKey: safe(published?.snapshotKey),
    publishedAt: safe(published?.createdAt),
  };
}

export async function loadManifest(shareId) {
  const id = safe(shareId);
  if (!id) throw new Error("MISSING_shareId");

  const url = `${DEFAULT_API_BASE}/publish/${encodeURIComponent(id)}.json`;
  const r = await fetch(url, { cache: "no-store" });

  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`MANIFEST_HTTP_${r.status}${txt ? ` :: ${txt.slice(0, 160)}` : ""}`);
  }

  const j = await r.json();

  // Published wrapper -> convert
  if (j && typeof j === "object" && j.snapshot) {
    const m = normalizePublishedSnapshotToManifest(j);
    if (!m) throw new Error("PUBLISHED_SNAPSHOT_INVALID");
    return m;
  }

  // Already manifest-like
  return j;
}

export default loadManifest;
