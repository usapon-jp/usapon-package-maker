import { openDB } from "idb";
import type { StampItem } from "../../app/app-types";

const database = () => openDB("usapon-stamp-library", 1, {
  upgrade(db) { db.createObjectStore("images"); },
});

// Separate from drafts; partition local images by the signed-in account.
export async function loadMyImages(owner: string): Promise<StampItem[]> {
  const db = await database();
  return db.getAll("images", IDBKeyRange.bound([owner, ""], [owner, "\uffff"]));
}

export async function saveMyImage(owner: string, item: StampItem): Promise<void> {
  if (item.assetRef.kind !== "user") return;
  const db = await database();
  await db.put("images", item, [owner, item.assetRef.assetId]);
}

export function mergeMyImages(...groups: StampItem[][]): StampItem[] {
  const images = new Map<string, StampItem>();
  for (const item of groups.flat()) {
    if (item.assetRef.kind === "user") images.set(item.assetRef.assetId, item);
  }
  return [...images.values()];
}
