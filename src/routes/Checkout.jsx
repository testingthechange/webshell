import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { loadManifest } from "../lib/loadManifest.js";

/**
 * Fake checkout (beta)
 * - No payments
 * - On complete:
 *   1) marks mock_owned:<shareId>=1
 *   2) upserts album entry into mock_library (My Collection)
 *   3) redirects to /account/:shareId
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

  function upsertLibraryEntry() {
    if (!shareId) return;

    const title = manifest?.title || manifest?.album?.title || "Album";
    const artist = manifest?.artist || manifest?.album?.artist || "";
    const coverUrl = manifest?.coverUrl || manifest?.album?.coverUrl || "";
    const purchasedAt = new Date().toISOString();

    const entry = { shareId, title, artist, coverUrl, purchasedAt };

    try {
      const raw = localStorage.getItem("mock_library");
      const list = Array.isArray(JSON.parse(raw || "[]")) ? JSON.parse(raw || "[]") : [];

      const idx = list.findIndex((x) => x?.shareId === shareId);
      if (idx >= 0) list[idx] = { ...list[idx], ...entry };
      else list.unshift(entry);

      localStorage.setItem("mock_library", JSON.stringify(list));
    } catch {
      // ignore
    }
  }

  function completePurchase() {
    if (!shareId) {
      nav("/account");
      return;
    }

    try {
      localStorage.setItem(ownedKey, "1");
    } catch {}

    upsertLibraryEntry();
    nav(`/account/${shareId}?purchased=1`);
  }

  const title = manifest?.title || manifest?.album?.title || "Checkout";

  return (
    <div style={{ width: "70%", maxWidth: 980, margin: "0 auto", padding: "28px 0" }}>
      <div style={{ fontWeight: 900, fontSize: 22, marginBottom: 6 }}>Checkout</div>
      <div style={{ opacity: 0.75, marginBottom: 18 }}>
        Fake checkout (beta). No payment processed.
      </div>

      {error ? (
        <div style={{ marginBottom: 16, opacity: 0.85 }}>
          {error}
        </div>
      ) : null}

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
