export type DesignColorPreset = {
  name: string;
  value: `#${string}`;
};

export const FAVORITE_COLORS_STORAGE_KEY = "usapon-package-maker.favorite-colors.v1";
export const MAX_FAVORITE_COLORS = 12;

export const BASIC_DESIGN_COLORS: DesignColorPreset[] = [
  { name: "白", value: "#ffffff" },
  { name: "アイボリー", value: "#fffdf9" },
  { name: "黒", value: "#2f2927" },
  { name: "ブラウン", value: "#7b5f57" },
  { name: "赤", value: "#df6672" },
  { name: "ピンク", value: "#efa6b3" },
  { name: "青", value: "#6f9bc5" },
  { name: "緑", value: "#7da582" },
];

export const RECOMMENDED_DESIGN_COLORS: DesignColorPreset[] = [
  { name: "水玉イエロー", value: "#f6d96f" },
  { name: "ひよこイエロー", value: "#ffd400" },
  { name: "うさぎベージュ", value: "#e6d8cc" },
  { name: "文字ブラウン", value: "#4b3a37" },
  { name: "さくらピンク", value: "#f3bdc7" },
  { name: "セージグリーン", value: "#abc4a1" },
  { name: "空色", value: "#a8c9df" },
  { name: "ラベンダー", value: "#c8b9dd" },
];

export function normalizeHexColor(color: string): `#${string}` | null {
  const normalized = color.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(normalized) ? normalized as `#${string}` : null;
}

export function addFavoriteColor(colors: string[], color: string) {
  const normalized = normalizeHexColor(color);
  if (!normalized || colors.includes(normalized)) return colors;
  return [...colors, normalized].slice(-MAX_FAVORITE_COLORS);
}

export function removeFavoriteColor(colors: string[], color: string) {
  const normalized = normalizeHexColor(color);
  return normalized ? colors.filter((item) => item !== normalized) : colors;
}

export function parseFavoriteColors(value: string | null) {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => typeof item === "string" ? normalizeHexColor(item) : null)
      .filter((item): item is `#${string}` => item !== null)
      .filter((item, index, items) => items.indexOf(item) === index)
      .slice(-MAX_FAVORITE_COLORS);
  } catch {
    return [];
  }
}
