// FILE: src/routes/Checkout.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { loadManifest } from "../lib/loadManifest.js";

const COLLECTION_KEY = "bb_collection_v1";

function safeString(v) {
  return String(v ?? "").trim();
}

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function readCollectionRaw() {
  try {
    const raw = localStorage.getItem(COLLECTION_KEY);
    const parsed = raw ? safeParse(raw) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// helps if older shapes ever existed
function loadCollectionIds() {
  const parsed = readCollectionRaw();
  const out = [];

  for (const x of parsed) {
    if (!x) continue;
    if (typeof x === "string") out.push(safeString(x));
    else out.push(safeString(x?.shareId || x?.id || x?.share_id || x?.shareID || ""));
  }

  const seen = new Set();
  const deduped = [];
  for (const id of out) {
    const v = safeString(id);
    if (!v || seen.has(v)) continue;
    seen.add(v);
    deduped.push(v);
  }
  return deduped;
}

function saveCollectionIds(ids) {
  const cleaned = [];
  const seen = new Set();
  for (const x of ids || []) {
    const id = safeString(x);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    cleaned.push(id);
  }
  try {
    localStorage.setItem(COLLECTION_KEY, JSON.stringify(cleaned));
  } catch {}
  return cleaned;
}

function ensureShareIdInCollection(shareId) {
  const id = safeString(shareId);
  if (!id) return [];
  const existing = loadCollectionIds();
  const next = [id, ...existing.filter((x) => x !== id)];
  return saveCollectionIds(next);
}

/**
 * Fake checkout (beta)
 * - No payments
 * - On complete:
 *   1) marks mock_owned:<shareId>=1
 *   2) upserts shareId into bb_collection_v1 (My Collection)
 *   3) redirects to /account/:shareId?purchased=1
 */
export default function Checkout() {
  const { shareId = "" } = useParams();
  const nav = useNavigate();

  const ownedKey = useMemo(() => `mock_owned:${shareId}`, [shareId]);
  const [manifest, setManifest] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError("");
        if (!shareId) return;
        const m = await loadManifest(shareId);
        if (cancelled) return;
        setManifest(m);
      } catch (e) {
        if (!cancelled) setError(String(e?.message || e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shareId]);

  function completePurchase() {
    if (!shareId) {
      nav("/account");
      return;
    }

    // (1) REQUIRED: owned flag
    try {
      localStorage.setItem(ownedKey, "1");
    } catch {}

    // (2) REQUIRED: collection list
    ensureShareIdInCollection(shareId);

    // (3) OPTIONAL: session receipt (lets Account self-heal if query drops)
    try {
      sessionStorage.setItem("bb_last_purchase_v1", JSON.stringify({ shareId, ts: Date.now() }));
    } catch {}

    // (4) redirect
    nav(`/account/${shareId}?purchased=1`, { replace: true });
  }

  const title = manifest?.title || manifest?.album?.title || "Checkout";

  return (
    <div style={{ width: "70%", maxWidth: 980, margin: "0 auto", padding: "28px 0" }}>
      <div style={{ fontWeight: 900, fontSize: 22, marginBottom: 6 }}>Checkout</div>
      <div style={{ opacity: 0.75, marginBottom: 18 }}>Fake checkout (beta). No payment processed.</div>

      {error ? <div style={{ marginBottom: 16, opacity: 0.85 }}>{error}</div> : null}

      <div
        style={{
          padding: 18,
          borderRadius: 20,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.03)",
          marginBottom: 18,
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Purchasing</div>
        <div style={{ opacity: 0.85, lineHeight: 1.6 }}>
          {title}
          <br />
          <span style={{ opacity: 0.7 }}>{shareId}</span>
        </div>

        <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7, lineHeight: 1.6 }}>
          Placeholders (later):
          <br />• Directus CC page
          <br />• Polygon NFT mint/unlock
          <br />• Playlist builder
        </div>
      </div>

      <button
        type="button"
        onClick={completePurchase}
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
        Complete Purchase (mock) → Add to My Collection → Go to Account
      </button>
    </div>
  );
}
