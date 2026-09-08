import { openDB } from "idb";
import type { StampItem } from "../../app/app-types";

type StoredStampItem = StampItem & { savedAt?: number };

const database = () => openDB("usapon-stamp-library", 1, {
  upgrade(db) { db.createObjectStore("images"); },
});

const RETIRED_SAMPLE_FILE_NAMES = new Set(["usapon-ui-review.svg"]);

// Separate from drafts; partition local images by the signed-in account.
export async function loadMyImages(owner: string): Promise<StampItem[]> {
  const db = await database();
  const images = await db.getAll("images", IDBKeyRange.bound([owner, ""], [owner, "\uffff"])) as StoredStampItem[];
  const retired = images.filter((item) => RETIRED_SAMPLE_FILE_NAMES.has(item.fileName));
  await Promise.all(retired.map((item) => item.assetRef.kind === "user" ? db.delete("images", [owner, item.assetRef.assetId]) : undefined));
  return images.filter((item) => !RETIRED_SAMPLE_FILE_NAMES.has(item.fileName)).sort((a, b) => (a.savedAt ?? 0) - (b.savedAt ?? 0));
}

export async function saveMyImage(owner: string, item: StampItem): Promise<void> {
  if (item.assetRef.kind !== "user") return;
  const db = await database();
  const key = [owner, item.assetRef.assetId];
  const existing = await db.get("images", key) as StoredStampItem | undefined;
  await db.put("images", { ...item, savedAt: existing?.savedAt ?? Date.now() }, key);
}

export function mergeMyImages(...groups: StampItem[][]): StampItem[] {
  const images = new Map<string, StoredStampItem>();
  for (const item of groups.flat()) {
    if (item.assetRef.kind === "user" && !RETIRED_SAMPLE_FILE_NAMES.has(item.fileName)) {
      const existing = images.get(item.assetRef.assetId);
      images.set(item.assetRef.assetId, { ...item, savedAt: (item as StoredStampItem).savedAt ?? existing?.savedAt });
    }
  }
  return [...images.values()];
}
