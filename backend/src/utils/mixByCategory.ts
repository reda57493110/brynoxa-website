/**
 * The shop's "Recommended" order (sort=mixed): one product of each kind in turn — a gaming PC, a
 * laptop, a desktop, a monitor, an accessory… then the next round — so the same kind never fills
 * the first rows. Kinds are main categories (a sub-category counts as its main one). Inside a kind
 * the newest comes first; the kind with the newest product starts each round.
 */
export type MixItem = { id: string; category: string | null; createdAt: number };

export function mixByCategory(items: MixItem[], mainOf: (categoryId: string | null) => string): string[] {
  const groups = new Map<string, MixItem[]>();
  for (const item of [...items].sort((a, b) => b.createdAt - a.createdAt)) {
    const key = mainOf(item.category);
    const list = groups.get(key);
    if (list) list.push(item);
    else groups.set(key, [item]);
  }
  // Groups in order of their newest product (the Map keeps insertion order = newest first)
  const queues = [...groups.values()];
  const out: string[] = [];
  for (let round = 0; out.length < items.length; round++) {
    for (const q of queues) if (q[round]) out.push(q[round].id);
  }
  return out;
}
