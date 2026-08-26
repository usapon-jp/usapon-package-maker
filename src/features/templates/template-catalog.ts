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
  themePackId?: string;
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
  stampKeys: ["autumn-rabbit-acorn-hug", "autumn-rabbit-sweet-potato-car", "autumn-rabbit-sweet-potato", "autumn-rabbit-chestnut", "autumn-rabbit-sleeping-sweet-potato"],
}];

export const PACKAGE_TEMPLATES: PackageTemplate[] = [
  {
    id: "y2-kamasu-envelope",
    name: "洋形2号カマス貼り封筒",
    category: "envelope",
    categoryLabel: "封筒",
    seriesId: "basic-letter-set",
    seriesName: "基本のレターセット",
    description: "完成162 × 114mm。A4実寸で作れる基本の封筒です。",
    badge: "無料",
    box: { ...defaults, type: "envelope-v1", widthMm: 162, heightMm: 114, glueFlapMm: 12, envelopeConstruction: "kamasu" },
    previewStampKey: "usapon-box-rabbits",
    recommendedStampSetIds: [],
    writingLines: false,
  },
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
    themePackId: "autumn-letter-set",
  },
  {
    id: "autumn-envelope",
    name: "秋うさぎの封筒",
    category: "envelope",
    categoryLabel: "封筒",
    seriesId: "autumn-letter-set",
    seriesName: "秋のレターセット",
    description: "洋形2号・カマス貼り。A4から切って折り、左右を貼って作れます。",
    badge: "A4実寸",
    box: { ...defaults, type: "envelope-v1", widthMm: 162, heightMm: 114, glueFlapMm: 12, envelopeConstruction: "kamasu" },
    previewStampKey: "autumn-rabbit-sweet-potato-car",
    recommendedStampSetIds: ["autumn-rabbits"],
    writingLines: false,
    themePackId: "autumn-letter-set",
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
    themePackId: "autumn-letter-set",
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
