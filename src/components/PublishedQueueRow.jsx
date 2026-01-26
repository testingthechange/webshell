import { useEffect, useState } from "react";
import { signImage } from "../lib/signImage";

const API_BASE =
  String(import.meta?.env?.VITE_API_BASE || "").trim().replace(/\/+$/, "") ||
  "https://album-backend-kmuo.onrender.com";

export default function PublishedQueueRow({ shareId, title, artist }) {
  const [coverUrl, setCoverUrl] = useState("");
  const [imgOk, setImgOk] = useState(true);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setCoverUrl("");
        setImgOk(true);

        const r = await fetch(
          `${API_BASE}/publish/${encodeURIComponent(shareId)}.json`,
          { cache: "no-store" }
        );
        if (!r.ok) return;

        const j = await r.json();
        const snap = j?.snapshot || null;

        const coverKey =
          snap?.album?.cover?.s3Key ||
          snap?.album?.masterSave?.cover?.s3Key ||
          "";

        if (!coverKey) return;

        const signed = await signImage(coverKey);
        if (!signed) return;

        if (alive) setCoverUrl(signed);
      } catch {}
    }

    load();
    return () => {
      alive = false;
    };
  }, [shareId]);

  return (
    <div className="queue-row">
      <div className="queue-thumb">
        {coverUrl && imgOk ? (
          <img
            src={coverUrl}
            alt={title || ""}
            onError={() => setImgOk(false)}
          />
        ) : (
          <div className="queue-thumb-fallback">COVER</div>
        )}
      </div>

      <div className="queue-meta">
        <div className="queue-title">{title}</div>
        <div className="queue-artist">{artist}</div>
        <div className="queue-id">{shareId}</div>
      </div>
    </div>
  );
}
