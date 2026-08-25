import type { BuiltInStampKey } from "../../app/app-types";
import type { BoxInput, BoxType } from "../../domain/boxes/types";

export type TemplateCategory = "box" | "envelope" | "letter-paper" | "card" | "mount" | "tag";

export type PackageTemplate = {
  id: string;
  name: string;
  category: TemplateCategory;
  categoryLabel: string;
  seriesId: string;
  seriesName: string;
  description: string;
  badge?: string;
  box: BoxInput;
  previewStampKey: BuiltInStampKey;
  recommendedStampSetIds: string[];
  writingLines: boolean;
};

export type StampSet = {
  id: string;
  name: string;
  description: string;
  stampKeys: BuiltInStampKey[];
};

const defaults = { depthMm: 1, paperThicknessMm: 0.12, glueFlapMm: 12 };

export const STAMP_SETS: StampSet[] = [{
  id: "autumn-rabbits",
  name: "秋うさぎスタンプセット",
  description: "どんぐり・おいも・栗の秋うさぎ",
  stampKeys: ["autumn-rabbit-acorn-hug", "autumn-rabbit-sweet-potato-car", "autumn-rabbit-sweet-potato", "autumn-rabbit-chestnut"],
}];

export const PACKAGE_TEMPLATES: PackageTemplate[] = [
  {
    id: "autumn-letter-paper",
    name: "秋うさぎの便箋",
    category: "letter-paper",
    categoryLabel: "便箋",
    seriesId: "autumn-letter-set",
    seriesName: "秋のレターセット",
    description: "A4縦・書きやすい罫線付き。背景も文字も自由に編集。",
    badge: "人気",
    box: { ...defaults, type: "letter-paper-v1", widthMm: 190, heightMm: 277 },
    previewStampKey: "autumn-rabbit-acorn-hug",
    recommendedStampSetIds: ["autumn-rabbits"],
    writingLines: true,
  },
  {
    id: "autumn-envelope",
    name: "秋うさぎの封筒",
    category: "envelope",
    categoryLabel: "封筒",
    seriesId: "autumn-letter-set",
    seriesName: "秋のレターセット",
    description: "A4から切って折る、のりしろ付きの封筒展開図。",
    badge: "おそろい",
    box: { ...defaults, type: "envelope-v1", widthMm: 150, heightMm: 100, glueFlapMm: 14 },
    previewStampKey: "autumn-rabbit-sweet-potato-car",
    recommendedStampSetIds: ["autumn-rabbits"],
    writingLines: false,
  },
  {
    id: "autumn-mini-card",
    name: "秋うさぎのミニカード",
    category: "card",
    categoryLabel: "ミニカード",
    seriesId: "autumn-letter-set",
    seriesName: "秋のレターセット",
    description: "91 × 55mm。A4に同じデザインをまとめて面付け。",
    badge: "A4に10枚",
    box: { ...defaults, type: "mini-card-v1", widthMm: 91, heightMm: 55 },
    previewStampKey: "autumn-rabbit-sleeping-sweet-potato",
    recommendedStampSetIds: ["autumn-rabbits"],
    writingLines: false,
  },
];

export function templateById(id: string | null | undefined) {
  return PACKAGE_TEMPLATES.find((template) => template.id === id) ?? null;
}

export function isStationeryType(type: BoxType) {
  return type === "letter-paper-v1" || type === "envelope-v1" || type === "mini-card-v1";
}

export function stampSetsForTemplate(template: PackageTemplate | null) {
  if (!template) return [];
  return template.recommendedStampSetIds.flatMap((id) => STAMP_SETS.filter((set) => set.id === id));
}
