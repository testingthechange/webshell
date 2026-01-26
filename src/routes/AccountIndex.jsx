import { Navigate } from "react-router-dom";

const COLLECTION_KEY = "bb_collection_v1";

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

export default function AccountIndex() {
  const rows = readCollection();
  const first = rows?.[0];
  const shareId = String(first?.shareId || "").trim();

  if (shareId) return <Navigate to={`/account/${shareId}`} replace />;
  return <Navigate to="/shop" replace />;
}
