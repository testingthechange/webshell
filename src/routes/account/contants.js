// src/routes/account/constants.js
export const COLLECTION_KEY = "bb_collection_v1";

export const API_BASE =
  String(import.meta?.env?.VITE_API_BASE || "").trim().replace(/\/+$/, "") ||
  "https://album-backend-kmuo.onrender.com";
