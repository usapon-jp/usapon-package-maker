import type { BuiltInStampKey, DielineLineColors, EnvelopeDesignSettings } from "../../app/app-types";
import type { EnvelopeFaceId } from "../../domain/boxes/types";

export type ThemeColorRole = "background" | "text" | "frame" | "accent";

export type ThemePackDefinition = {
  id: string;
  name: string;
  description: string;
  badge: string;
  stampKeys: BuiltInStampKey[];
  colors: Array<{ name: string; value: `#${string}`; role: ThemeColorRole }>;
  preset: {
    pageBackgrounds: { main: string; letter: string; card: string };
    surfaceBackgrounds: Record<EnvelopeFaceId, string>;
    lineColors: DielineLineColors;
    envelopeDesign: EnvelopeDesignSettings;
    textColor: string;
  };
};

export const AUTUMN_THEME_PACK: ThemePackDefinition = {
  id: "autumn-letter-set",
  name: "秋のレターセット",
  description: "秋うさぎスタンプと、背景・文字・枠・アクセントをおそろいで使えるテーマパック",
  badge: "合言葉で解除",
  stampKeys: [
    "autumn-rabbit-acorn-hug",
    "autumn-rabbit-sweet-potato-car",
    "autumn-rabbit-sweet-potato",
    "autumn-rabbit-chestnut",
    "autumn-rabbit-sleeping-sweet-potato",
  ],
  colors: [
    { name: "焼きいもクリーム", value: "#fff4dc", role: "background" },
    { name: "落ち葉ベージュ", value: "#ead2ad", role: "background" },
    { name: "栗ブラウン", value: "#5d3d2c", role: "text" },
    { name: "木の実ブラウン", value: "#9a633f", role: "frame" },
    { name: "もみじオレンジ", value: "#d8793f", role: "accent" },
    { name: "森のセージ", value: "#7f8b58", role: "accent" },
  ],
  preset: {
    pageBackgrounds: { main: "#fff4dc", letter: "#fffaf0", card: "#fff7e8" },
    surfaceBackgrounds: { "envelope-front": "#fff4dc", "envelope-flap": "#d8793f", "envelope-back": "#ead2ad" },
    lineColors: { cut: "#8d674f", fold: "#b99579" },
    envelopeDesign: { style: "cute", flapAccentEnabled: true, flapColor: "#d8793f", flapPattern: "dots", showAddressField: true, showAddressLines: true, marginMm: 10 },
    textColor: "#5d3d2c",
  },
};

export const THEME_PACKS = [AUTUMN_THEME_PACK] as const;

export function themePackById(id: string | null | undefined) {
  return THEME_PACKS.find((pack) => pack.id === id) ?? null;
}
