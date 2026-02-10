// FILE: src/routes/Home.jsx
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function Home() {
  const nav = useNavigate();
  const [shareId, setShareId] = useState("");

  const cleaned = useMemo(() => String(shareId || "").trim(), [shareId]);
  const canGo = cleaned.length > 0;

  function goProduct() {
    if (!canGo) return;
    nav(`/product/${encodeURIComponent(cleaned)}`);
  }

  function goAccount() {
    if (!canGo) return;
    nav(`/account/${encodeURIComponent(cleaned)}`);
  }

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "56px 18px" }}>
      <h1 style={{ fontSize: 44, margin: 0, lineHeight: 1.05 }}>Block Radius</h1>

      <p style={{ marginTop: 14, fontSize: 16, opacity: 0.85, maxWidth: 720, lineHeight: 1.5 }}>
        Beta entry. Paste a <b>shareId</b> from the admin publish payload and open the Product / Account pages.
      </p>

      <div style={{ marginTop: 28, padding: 16, border: "1px solid #e5e7eb", borderRadius: 14 }}>
        <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>shareId</div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={shareId}
            onChange={(e) => setShareId(e.target.value)}
            placeholder="paste shareId here"
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #d1d5db",
              minWidth: 340,
              fontSize: 14,
            }}
          />

          <button
            type="button"
            onClick={goProduct}
            disabled={!canGo}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #111827",
              background: canGo ? "#111827" : "#e5e7eb",
              color: canGo ? "#fff" : "#6b7280",
              fontWeight: 900,
              cursor: canGo ? "pointer" : "not-allowed",
            }}
            title={!canGo ? "Paste a shareId first" : "Open Product"}
          >
            Open Product
          </button>

          <button
            type="button"
            onClick={goAccount}
            disabled={!canGo}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #d1d5db",
              background: "#fff",
              color: "#111827",
              fontWeight: 900,
              cursor: canGo ? "pointer" : "not-allowed",
              opacity: canGo ? 1 : 0.6,
            }}
            title={!canGo ? "Paste a shareId first" : "Open Account"}
          >
            Open Account
          </button>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7, lineHeight: 1.4 }}>
          Quick links after you paste an id:
          {" "}
          <code>/product/&lt;shareId&gt;</code>
          {" "}
          <span style={{ opacity: 0.6 }}>and</span>
          {" "}
          <code>/account/&lt;shareId&gt;</code>
        </div>
      </div>

      <div style={{ marginTop: 22 }}>
        <Link to="/shop" style={{ fontSize: 14 }}>
          Browse Shop
        </Link>
      </div>
    </div>
  );
}
