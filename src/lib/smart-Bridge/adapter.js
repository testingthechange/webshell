// FILE: src/lib/smart-Bridge/adapter.js
// Account-only adapter (pure, testable)

export function adaptEdge(fromSlot, toSlot, tracks, connections) {
  const bySlot = new Map((tracks || []).map((t) => [Number(t.slot), t]));
  const from = bySlot.get(Number(fromSlot));
  const to = bySlot.get(Number(toSlot));

  const fromUrlKey = from?.files?.album?.s3Key ?? null;
  const toUrlKey = to?.files?.album?.s3Key ?? null;

  const edgeKey = `${Number(fromSlot)}-${Number(toSlot)}`;
  const bridgeKey = connections?.[edgeKey]?.bridge?.s3Key ?? null;

  return {
    fromUrlKey,
    bridgeKey,
    toUrlKey,
    toChoice: { slot: Number(toSlot), edgeKey: bridgeKey ? edgeKey : null },
  };
}

// Optional alias so older code still works if it imported a different name
export const adaptSmartBridgeEdge = adaptEdge;

export default adaptEdge;
