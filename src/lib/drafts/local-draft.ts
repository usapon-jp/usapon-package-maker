import { openDB } from "idb";

import type { AppState, ArtworkLayer, StampItem } from "../../app/app-types";
import type { ProjectWorkspace } from "../../cloud/types";
import { blobToDataUrl } from "../uploads/read-pattern";

const DATABASE_NAME = "usapon-package-maker";
const STORE_NAME = "drafts";
const CURRENT_DRAFT_KEY = "current-v1";

export type LocalDraft = {
  state: AppState;
  workspace: ProjectWorkspace | null;
  savedAt: string;
};

async function database() {
  if (typeof indexedDB === "undefined") throw new Error("このブラウザでは端末内保存を利用できません。");
  return openDB(DATABASE_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    },
  });
}

function stripRenderUrl<T extends ArtworkLayer | StampItem>(item: T): T {
  if (!("blob" in item) || !item.blob) return item;
  return { ...item, dataUrl: "" };
}

async function restoreRenderUrl<T extends ArtworkLayer | StampItem>(item: T): Promise<T> {
  if (!("dataUrl" in item) || item.dataUrl || !("blob" in item) || !item.blob) return item;
  try {
    return { ...item, dataUrl: await blobToDataUrl(item.blob) };
  } catch {
    // 一つの画像が壊れていても、下書き全体を初期状態へ戻してはいけない。
    return item;
  }
}

export async function saveLocalDraft(state: AppState, workspace: ProjectWorkspace | null): Promise<void> {
  const db = await database();
  const storedState: AppState = {
    ...state,
    artworkLayers: state.artworkLayers.map(stripRenderUrl),
    stamps: state.stamps.map(stripRenderUrl),
  };
  await db.put(STORE_NAME, { state: storedState, workspace, savedAt: new Date().toISOString() } satisfies LocalDraft, CURRENT_DRAFT_KEY);
}

export async function loadLocalDraft(): Promise<LocalDraft | null> {
  const db = await database();
  const draft = await db.get(STORE_NAME, CURRENT_DRAFT_KEY) as LocalDraft | undefined;
  if (!draft) return null;
  return {
    ...draft,
    state: {
      ...draft.state,
      artworkLayers: await Promise.all(draft.state.artworkLayers.map(restoreRenderUrl)),
      stamps: await Promise.all(draft.state.stamps.map(restoreRenderUrl)),
    },
  };
}

export async function clearLocalDraft(): Promise<void> {
  const db = await database();
  await db.delete(STORE_NAME, CURRENT_DRAFT_KEY);
}
