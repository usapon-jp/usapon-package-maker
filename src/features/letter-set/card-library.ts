import { openDB } from "idb";
import type { CardDesignData } from "./mini-card-project";
export type SavedCard = { id: string; name: string; data: CardDesignData; savedAt: number };
const database = () => openDB("usapon-finished-card-library", 1, { upgrade(db) { db.createObjectStore("cards"); } });
export async function loadCardLibrary(owner: string): Promise<SavedCard[]> {
  const db = await database();
  const cards = await db.getAll("cards", IDBKeyRange.bound([owner, ""], [owner, "\uffff"])) as SavedCard[];
  return cards.sort((a, b) => b.savedAt - a.savedAt);
}
export async function saveLibraryCard(owner: string, card: Omit<SavedCard, "savedAt">): Promise<void> {
  const db = await database();
  await db.put("cards", { ...card, savedAt: Date.now() }, [owner, card.id]);
}
