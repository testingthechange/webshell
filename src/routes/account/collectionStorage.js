// FILE: src/routes/account/Account.jsx
import React, { useEffect, useMemo } from "react";
import { useLocation, useParams } from "react-router-dom";
import { ensureShareIdInCollection } from "./ui/collectionStorage.js";

// NOTE: keep your existing imports/rendering below as-is.
// This file’s only “new truth” is: purchased=1 writes shareId into My Collection.

function useQuery(search) {
  return useMemo(() => new URLSearchParams(search || ""), [search]);
}

export default function Account() {
  const { shareId } = useParams();
  const location = useLocation();
  const q = useQuery(location.search);
  const purchased = q.get("purchased") || "";

  // STEP (3): landing the purchase in “My Collection”
  useEffect(() => {
    if (purchased === "1" && shareId) {
      ensureShareIdInCollection(shareId);
    }
  }, [purchased, shareId]);

  // ---- Existing Account page UI should remain below ----
  // If your repo previously rendered a player/collection here, keep it.
  // If not, this minimal shell still correctly lands purchases.
  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontWeight: 900, fontSize: 18 }}>Account</div>
      <div style={{ marginTop: 8, opacity: 0.75, fontSize: 12 }}>
        shareId: <code>{shareId || "—"}</code>
      </div>
      <div style={{ marginTop: 6, opacity: 0.75, fontSize: 12 }}>
        purchased: <code>{purchased || "—"}</code>
      </div>

      {/* Replace/keep the rest of your real Account UI here */}
    </div>
  );
}
