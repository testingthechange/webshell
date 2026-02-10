// FILE: src/routes/FakeCheckout.jsx
import React from "react";
import { useNavigate, useParams } from "react-router-dom";

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
  const raw = localStorage.getItem(COLLECTION_KEY);
  const parsed = raw ? safeParse(raw) : null;
  return Array.isArray(parsed) ? parsed : [];
}

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
  localStorage.setItem(COLLECTION_KEY, JSON.stringify(cleaned));
  return cleaned;
}

function ensureShareIdInCollection(shareId) {
  const id = safeString(shareId);
  if (!id) return [];
  const existing = loadCollectionIds();
  const next = [id, ...existing.filter((x) => x !== id)];
  return saveCollectionIds(next);
}

export default function FakeCheckout() {
  const nav = useNavigate();
  const params = useParams();
  const shareId = safeString(params?.shareId || params?.id || "");

  function buy() {
    if (!shareId) return;

    ensureShareIdInCollection(shareId);

    try {
      sessionStorage.setItem(
        "bb_last_purchase_v1",
        JSON.stringify({ shareId, ts: Date.now() })
      );
    } catch {}

    nav(`/account/${shareId}?purchased=1`, { replace: true });
  }

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "26px 18px" }}>
      <div style={{ fontWeight: 900, fontSize: 20 }}>Fake Checkout</div>

      <div style={{ marginTop: 10, opacity: 0.82 }}>
        Clicking buy will add this album to <b>My Collection</b> and redirect to your Account page.
      </div>

      <div style={{ marginTop: 12, fontFamily: "monospace", opacity: 0.75 }}>
        shareId: {shareId || "—"}
      </div>

      <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
        <button
          type="button"
          onClick={() => nav(-1)}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.92)",
            cursor: "pointer",
            fontWeight: 900,
          }}
        >
          Back
        </button>

        <button
          type="button"
          onClick={buy}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.22)",
            background: "rgba(255,255,255,0.14)",
            color: "rgba(255,255,255,0.92)",
            cursor: "pointer",
            fontWeight: 900,
          }}
        >
          Buy (mock) → Add to My Collection → Go to Account
        </button>
      </div>
    </div>
  );
}
