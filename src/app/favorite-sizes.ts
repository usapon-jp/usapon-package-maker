import type { BoxInput, BoxType } from "../domain/boxes/types";

export const FAVORITE_SIZES_STORAGE_KEY = "usapon-package-maker.favorite-sizes.v1";
export const MAX_FAVORITE_SIZES = 20;

export type FavoriteSize = {
  id: string;
  name: string;
  box: BoxInput;
};

const BOX_TYPES: BoxType[] = ["straight-tuck-carton-v1", "gift-box-v1", "two-piece-gift-box-v1"];

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isBoxInput(value: unknown): value is BoxInput {
  if (!value || typeof value !== "object") return false;
  const box = value as Partial<BoxInput>;
  return BOX_TYPES.includes(box.type as BoxType)
    && isPositiveNumber(box.widthMm)
    && isPositiveNumber(box.depthMm)
    && isPositiveNumber(box.heightMm)
    && isPositiveNumber(box.paperThicknessMm)
    && isPositiveNumber(box.glueFlapMm)
    && (box.lidDepthMm === undefined || isPositiveNumber(box.lidDepthMm))
    && (box.lidClearanceMm === undefined || isPositiveNumber(box.lidClearanceMm))
    && (box.foldoverMm === undefined || isPositiveNumber(box.foldoverMm));
}

export function parseFavoriteSizes(raw: string | null): FavoriteSize[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is FavoriteSize => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as Partial<FavoriteSize>;
      return typeof candidate.id === "string"
        && typeof candidate.name === "string"
        && candidate.name.trim().length > 0
        && isBoxInput(candidate.box);
    }).slice(0, MAX_FAVORITE_SIZES);
  } catch {
    return [];
  }
}

export function registerFavoriteSize(sizes: FavoriteSize[], name: string, box: BoxInput, id: string): FavoriteSize[] {
  const cleanName = name.trim().slice(0, 40);
  if (!cleanName) return sizes;
  const next = { id, name: cleanName, box: { ...box } };
  const existingIndex = sizes.findIndex((item) => item.name === cleanName);
  if (existingIndex >= 0) {
    return sizes.map((item, index) => index === existingIndex ? { ...next, id: item.id } : item);
  }
  return [next, ...sizes].slice(0, MAX_FAVORITE_SIZES);
}

