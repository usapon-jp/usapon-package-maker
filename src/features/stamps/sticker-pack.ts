import { strFromU8, unzipSync } from "fflate";

export type StickerPackFolder = { id: string; name: string; order: number };
export type StickerPackItem = {
  id: string;
  name: string;
  folderId: string;
  folderName: string;
  folderOrder: number;
  order: number;
  contentHash: string;
  bytes: Uint8Array;
};

const MAX_PACK_BYTES = 60 * 1024 * 1024;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export async function readUsaponStickerPack(file: File): Promise<{ folders: StickerPackFolder[]; stickers: StickerPackItem[] }> {
  if (file.size > MAX_PACK_BYTES) throw new Error("ステッカーパックが大きすぎます。");
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const manifestBytes = files["manifest.json"];
  if (!manifestBytes) throw new Error("ステッカーパックの情報が見つかりません。");
  let manifest: Record<string, unknown>;
  try { manifest = JSON.parse(strFromU8(manifestBytes)) as Record<string, unknown>; }
  catch { throw new Error("ステッカーパックの情報を読み取れません。"); }
  if (manifest.format !== "usapon-sticker-pack" || manifest.version !== 1 || !Array.isArray(manifest.stickers)) {
    throw new Error("対応していないステッカーパックです。");
  }
  if (manifest.stickers.length > 100) throw new Error("一度に読み込めるステッカーは100点までです。");
  const rawFolders = Array.isArray(manifest.folders) ? manifest.folders : [];
  const folders = rawFolders.flatMap((value, index) => {
    const folder = value as Record<string, unknown>;
    const id = typeof folder.id === "string" ? folder.id.slice(0, 80) : "";
    if (!id || id === "unfiled") return [];
    return [{ id, name: typeof folder.name === "string" ? folder.name.trim().slice(0, 48) : `フォルダ${index + 1}`, order: Number(folder.order) || index }];
  }).sort((left, right) => left.order - right.order);
  const folderById = new Map(folders.map(folder => [folder.id, folder]));
  const stickers = manifest.stickers.flatMap((value, index) => {
    const item = value as Record<string, unknown>;
    const bytes = typeof item.file === "string" ? files[item.file] : undefined;
    if (!bytes?.length || bytes.length > MAX_IMAGE_BYTES) return [];
    const folder = typeof item.folderId === "string" ? folderById.get(item.folderId) : undefined;
    return [{
      id: typeof item.id === "string" ? item.id.slice(0, 100) : crypto.randomUUID(),
      name: typeof item.name === "string" ? item.name.trim().slice(0, 48) : `マイステッカー${index + 1}`,
      folderId: folder?.id ?? "unfiled",
      folderName: folder?.name ?? "未分類",
      folderOrder: folder?.order ?? -1,
      order: Number(item.order) || index,
      contentHash: typeof item.contentHash === "string" ? item.contentHash.slice(0, 128) : "",
      bytes
    }];
  });
  if (!stickers.length) throw new Error("読み込めるPNGがありません。");
  return { folders, stickers };
}
