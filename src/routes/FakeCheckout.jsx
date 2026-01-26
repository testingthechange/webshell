import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

const COLLECTION_KEY = "bb_collection_v1";

const API_BASE =
  String(import.meta?.env?.VITE_API_BASE || "").trim().replace(/\/+$/, "") ||
  "https://album-backend-kmuo.onrender.com";

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function readCollection() {
  const raw = localStorage.getItem(COLLECTION_KEY);
  const arr = safeParse(raw || "[]");
  return Array.isArray(arr) ? arr.filter(Boolean) : [];
}

function upsertCollectionEntry(entry) {
  if (!entry?.shareId) return;
  const existing = readCollection();
  const next = [entry, ...existing.filter((a) => a?.shareId !== entry.shareId)].slice(0, 100);
  localStorage.setItem(COLLECTION_KEY, JSON.stringify(next));
}

export default function FakeCheckout() {
  const { shareId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handleFakeBuy = async () => {
    const id = String(shareId || "").trim();
    if (!id) return;

    setErr("");
    setLoading(true);

    try {
      // 1) Validate: must be a REAL published shareId
      const url = `${API_BASE}/publish/${encodeURIComponent(id)}.json`;
      const r = await fetch(url, { cache: "no-store" });

      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.snapshot) {
        throw new Error(
          `This album is not published (shareId not found). Please publish first.\n` +
            `GET /publish/${id}.json -> HTTP ${r.status}`
        );
      }

      // 2) Hydrate minimal collection entry (thumbnail comes from coverS3Key)
      const snap = j.snapshot || {};
      const meta = snap?.album?.meta || snap?.album?.masterSave?.meta || {};
      const cover = snap?.album?.cover || snap?.album?.masterSave?.cover || {};

      const entry = {
        shareId: id,
        projectId: String(j?.projectId || snap?.projectId || ""),
        title: String(meta?.albumTitle || snap?.projectName || "Album"),
        artist: String(meta?.artistName || snap?.company || ""),
        coverS3Key: String(cover?.s3Key || ""),
        purchasedAt: new Date().toISOString(),
      };

      upsertCollectionEntry(entry);
      localStorage.setItem(`mock_owned:${id}`, "1");

      // 3) Go to account
      navigate(`/account/${id}?purchased=1`);
    } catch (e) {
      // IMPORTANT: do NOT mark owned, do NOT add to collection
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="main-content" style={{ maxWidth: 560, margin: "0 auto" }}>
      <div className="page-title">Checkout</div>
      <div className="page-heading">Confirm Purchase</div>

      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header">Fake Checkout</div>

        <div style={{ opacity: 0.8, marginBottom: 16, lineHeight: 1.5 }}>
          Temporary checkout flow for development.
          <br />
          Clicking buy will add this album to <b>My Collection</b> and redirect to your Account page.
        </div>

        {err ? (
          <div
            style={{
              marginBottom: 14,
              padding: 12,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.06)",
              whiteSpace: "pre-wrap",
            }}
          >
            {err}
          </div>
        ) : null}

        <button className="buy-button" onClick={handleFakeBuy} disabled={!shareId || loading}>
          {loading ? "Checking publish…" : "Buy (Fake)"}
        </button>

        <div style={{ marginTop: 16, fontSize: 12, opacity: 0.65, lineHeight: 1.4 }}>
          Future:
          <br />• Directus credit card checkout (placeholder)
          <br />• Polygon NFT mint + assignment (placeholder)
        </div>
      </div>
    </div>
  );
}
