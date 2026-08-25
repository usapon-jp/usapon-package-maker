import type { TextAlignment, TextFontWeight, TextItem } from "../../app/app-types";
import type { DielineGeometry, DielinePageId } from "../../domain/boxes/types";
import { clamp } from "../../domain/units";
import { intersectionArea, primarySafeRect, rectArea } from "./package-safe-area";
import { stampRect } from "./stamp-layout";
import { DENSITY_SCALE, SIZE_SCALE } from "./style-presets";
import type { AutoLayoutSettings, LayoutRect, SeededRandom, StylePreset } from "./types";

export const DEFAULT_TEXT_STYLE = {
  role: "text" as const,
  letterSpacingMm: 0,
  lineHeight: 1.25,
  alignment: "middle" as const,
  fontWeight: 700 as const,
  arcMm: 0,
  strokeColor: null,
  strokeWidthMm: 0,
  labelColor: null,
  labelPaddingMm: 1.8,
};

export function createTextItem(id: string, pageId: DielinePageId, text: string, xMm: number, yMm: number, color = "#6d4037"): TextItem {
  return {
    id,
    kind: "text",
    pageId,
    text,
    xMm,
    yMm,
    fontSizeMm: 6,
    color,
    ...DEFAULT_TEXT_STYLE,
  };
}

export function normalizeTextItem(item: TextItem): TextItem {
  return { ...DEFAULT_TEXT_STYLE, ...item, role: item.role === "logoText" ? "logoText" : "text" };
}

export function textLineWidth(item: TextItem, line: string) {
  const count = [...line].length;
  return Math.max(item.fontSizeMm * 1.2, count * item.fontSizeMm * 0.62 + Math.max(0, count - 1) * item.letterSpacingMm);
}

export function textRect(rawItem: TextItem): LayoutRect {
  const item = normalizeTextItem(rawItem);
  const lines = item.text.split("\n");
  const width = Math.max(...lines.map((line) => textLineWidth(item, line)), item.fontSizeMm);
  const height = item.fontSizeMm + Math.max(0, lines.length - 1) * item.fontSizeMm * item.lineHeight + Math.abs(item.arcMm);
  const padding = item.labelColor ? item.labelPaddingMm : 0;
  const x = item.alignment === "start" ? item.xMm : item.alignment === "end" ? item.xMm - width : item.xMm - width / 2;
  return { x: x - padding, y: item.yMm - height / 2 - padding, width: width + padding * 2, height: height + padding * 2 };
}

function alignmentFor(preset: StylePreset, random: SeededRandom): TextAlignment {
  if (preset.taste === "pop") return "middle";
  if (preset.taste === "elegant") return random.pick(["middle", "middle", "start"] as const);
  return random.pick(["middle", "middle", "start", "end"] as const);
}

export function layoutTexts(
  texts: TextItem[],
  geometry: DielineGeometry,
  preset: StylePreset,
  settings: AutoLayoutSettings,
  random: SeededRandom,
  stamps = [] as import("../../app/app-types").StampItem[],
) {
  const visible = texts.filter((item) => item.text.trim());
  if (!visible.length) return texts.map(normalizeTextItem);
  const panel = primarySafeRect(geometry, Math.max(0.115, preset.panelInsetRatio));
  const sizeScale = SIZE_SCALE[settings.size] * preset.textScale;
  const density = DENSITY_SCALE[settings.density];
  const arranged = new Map<string, TextItem>();
  const occupied = stamps.filter((item) => item.visible).map(stampRect);

  visible.forEach((rawItem, index) => {
    const item = normalizeTextItem(rawItem);
    const longestLine = item.text.split("\n").reduce((longest, line) => Math.max(longest, [...line].length), 1);
    const widthLimited = panel.width / Math.max(1.4, longestLine * 0.7);
    const heightLimited = panel.height * (visible.length === 1 ? 0.16 : 0.12);
    const fontSizeMm = clamp(Math.min(widthLimited, heightLimited) * sizeScale * random.between(0.92, 1.08), 2.5, 18);
    const alignment = alignmentFor(preset, random);
    const xJitter = panel.width * preset.asymmetry * random.between(-0.65, 0.65);
    const xMm = alignment === "start" ? panel.x : alignment === "end" ? panel.x + panel.width : panel.x + panel.width / 2 + xJitter;
    const base = {
      ...item,
      role: "text",
      xMm,
      yMm: panel.y + panel.height / 2,
      fontSizeMm,
      letterSpacingMm: Math.max(0, preset.letterSpacingMm * random.between(0.82, 1.18)),
      lineHeight: preset.lineHeight,
      alignment,
      fontWeight: preset.normalFontWeight as TextFontWeight,
      arcMm: 0,
      strokeColor: null,
      strokeWidthMm: 0,
      labelColor: null,
      labelPaddingMm: Math.max(1.4, fontSizeMm * 0.3),
    } as TextItem;
    const fractions = preset.taste === "pop" ? [0.2, 0.8, 0.34, 0.66, 0.5] : [0.18, 0.82, 0.3, 0.7, 0.5];
    let best = base;
    let bestOverlap = Number.POSITIVE_INFINITY;
    fractions.forEach((fraction, attempt) => {
      const trial = {
        ...base,
        yMm: panel.y + panel.height * clamp(fraction + random.between(-0.025, 0.025) + index * 0.045 / density.spacing, 0.12, 0.88),
      };
      const box = textRect(trial);
      const overlap = occupied.reduce((sum, obstacle) => sum + intersectionArea(box, obstacle) / Math.max(1, Math.min(rectArea(box), rectArea(obstacle))), 0)
        + attempt * 0.0001;
      if (overlap < bestOverlap) {
        best = trial;
        bestOverlap = overlap;
      }
    });
    arranged.set(item.id, best);
    occupied.push(textRect(best));
  });
  return texts.map((item) => arranged.get(item.id) ?? normalizeTextItem(item));
}

export function fitTextsToSafeArea(texts: TextItem[], geometry: DielineGeometry, preset: StylePreset) {
  const panel = primarySafeRect(geometry, Math.max(0.115, preset.panelInsetRatio));
  return texts.map((rawItem) => {
    let item = normalizeTextItem(rawItem);
    let bounds = textRect(item);
    const fitScale = Math.min(1, panel.width / Math.max(1, bounds.width), panel.height / Math.max(1, bounds.height));
    if (fitScale < 1) {
      item = {
        ...item,
        fontSizeMm: Math.max(2.5, item.fontSizeMm * fitScale),
        letterSpacingMm: item.letterSpacingMm * fitScale,
        arcMm: item.arcMm * fitScale,
        strokeWidthMm: item.strokeWidthMm * fitScale,
        labelPaddingMm: item.labelPaddingMm * fitScale,
      };
      bounds = textRect(item);
    }
    let dx = 0;
    let dy = 0;
    if (bounds.x < panel.x) dx = panel.x - bounds.x;
    if (bounds.x + bounds.width > panel.x + panel.width) dx = panel.x + panel.width - bounds.x - bounds.width;
    if (bounds.y < panel.y) dy = panel.y - bounds.y;
    if (bounds.y + bounds.height > panel.y + panel.height) dy = panel.y + panel.height - bounds.y - bounds.height;
    return { ...item, xMm: item.xMm + dx, yMm: item.yMm + dy };
  });
}
