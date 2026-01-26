const API_BASE =
  String(import.meta?.env?.VITE_API_BASE || "").trim().replace(/\/+$/, "") ||
  "https://album-backend-kmuo.onrender.com";

// Uses backend runtime signer (same as audio signing)
export async function signImage(s3Key) {
  const key = String(s3Key || "").trim();
  if (!key) return "";

  const r = await fetch(
    `${API_BASE}/api/playback-url?s3Key=${encodeURIComponent(key)}`,
    { cache: "no-store" }
  );

  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.ok) return "";

  return String(j?.url || j?.playbackUrl || "");
}
