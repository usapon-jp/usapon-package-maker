import type { DesignElementRole, TextItem } from "../../app/app-types";
import type { DielineGeometry } from "../../domain/boxes/types";
import { intersectionArea, packageSafetyScore, primarySafeRect, rectArea } from "./package-safe-area";
import { stampRect } from "./stamp-layout";
import { DENSITY_SCALE } from "./style-presets";
import { textRect } from "./text-layout";
import type { AutoLayoutSettings, LayoutDesign, LayoutRect, LayoutScoreBreakdown, StylePreset } from "./types";

type ScoredElement = {
  id: string;
  role: DesignElementRole;
  rect: LayoutRect;
  weight: number;
  rotationDeg: number;
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value));
}

function foregroundElements(design: LayoutDesign): ScoredElement[] {
  const stamps: ScoredElement[] = design.stamps.filter((item) => item.visible).map((item) => ({
    id: item.id,
    role: item.role ?? "stamp",
    rect: stampRect(item),
    weight: rectArea(stampRect(item)),
    rotationDeg: item.rotationDeg,
  }));
  const texts: ScoredElement[] = design.texts.filter((item) => item.text.trim()).map((item) => ({
    id: item.id,
    role: item.role ?? "text",
    rect: textRect(item),
    weight: rectArea(textRect(item)) * 1.35,
    rotationDeg: 0,
  }));
  return [...stamps, ...texts];
}

function pairOverlapRatio(elements: ScoredElement[], tolerance: number) {
  if (elements.length < 2) return 0;
  let overlap = 0;
  let pairs = 0;
  for (let left = 0; left < elements.length; left += 1) {
    for (let right = left + 1; right < elements.length; right += 1) {
      const smaller = Math.max(1, Math.min(rectArea(elements[left].rect), rectArea(elements[right].rect)));
      overlap += Math.max(0, intersectionArea(elements[left].rect, elements[right].rect) / smaller - tolerance);
      pairs += 1;
    }
  }
  return pairs ? overlap / pairs : 0;
}

function overlapFor(element: ScoredElement, elements: ScoredElement[]) {
  return elements
    .filter((other) => other.id !== element.id)
    .reduce((sum, other) => sum + intersectionArea(element.rect, other.rect) / Math.max(1, Math.min(rectArea(element.rect), rectArea(other.rect))), 0);
}

function whitespaceScore(geometry: DielineGeometry, elements: ScoredElement[], settings: AutoLayoutSettings, preset: StylePreset) {
  if (!elements.length) return 100;
  const panelArea = geometry.panels
    .filter((panel) => !panel.label.includes("折り返し"))
    .reduce((sum, panel) => sum + panel.width * panel.height, 0);
  const occupied = elements.reduce((sum, element) => sum + rectArea(element.rect), 0);
  const target = preset.whitespaceTarget * DENSITY_SCALE[settings.density].coverage;
  const ratio = occupied / Math.max(1, panelArea);
  return clampScore(100 * (1 - Math.abs(ratio - target) / Math.max(0.12, target * 1.4)));
}

function readabilityScore(geometry: DielineGeometry, texts: TextItem[], elements: ScoredElement[]) {
  const readableTexts = texts.filter((item) => item.text.trim());
  if (!readableTexts.length) return 100;
  const scores = readableTexts.map((item) => {
    const element = elements.find((candidate) => candidate.id === item.id)!;
    const size = Math.min(1, Math.max(0, (item.fontSizeMm - 2) / 4));
    const spacing = item.letterSpacingMm >= -0.05 ? 1 : 0.35;
    const safety = packageSafetyScore(geometry, element.rect, item.role ?? "text");
    const overlap = Math.min(1, overlapFor(element, elements));
    return (size * 0.28 + spacing * 0.14 + safety * 0.42 + (1 - overlap) * 0.16) * 100;
  });
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function balanceScore(geometry: DielineGeometry, elements: ScoredElement[]) {
  if (!elements.length) return 100;
  const main = primarySafeRect(geometry, 0.06);
  const lead = [...elements].sort((a, b) => b.weight - a.weight)[0];
  const center = { x: main.x + main.width / 2, y: main.y + main.height / 2 };
  const leadCenter = { x: lead.rect.x + lead.rect.width / 2, y: lead.rect.y + lead.rect.height / 2 };
  const distance = Math.hypot(leadCenter.x - center.x, leadCenter.y - center.y);
  const diagonal = Math.max(1, Math.hypot(main.width, main.height));
  return clampScore(100 * (1 - distance / (diagonal * 0.72)));
}

function styleMatchScore(design: LayoutDesign, settings: AutoLayoutSettings, preset: StylePreset) {
  const visibleStamps = design.stamps.filter((item) => item.visible);
  const texts = design.texts.filter((item) => item.text.trim());
  const rotation = visibleStamps.length
    ? visibleStamps.reduce((sum, item) => sum + Math.abs((((item.rotationDeg + 180) % 360) + 360) % 360 - 180), 0) / visibleStamps.length
    : 0;
  const targetRotation = preset.taste === "pop" ? 10 : preset.taste === "natural" ? 3 : 0;
  const rotationMatch = 1 - Math.min(1, Math.abs(rotation - targetRotation) / 22);
  const spacingMatch = texts.length
    ? texts.reduce((sum, item) => sum + (1 - Math.min(1, Math.abs(item.letterSpacingMm - preset.letterSpacingMm) / 0.8)), 0) / texts.length
    : 1;
  const logoMatch = settings.logoEnabled && texts.length ? texts.filter((item) => item.role === "logoText").length / texts.length : 1;
  return clampScore((rotationMatch * 0.42 + spacingMatch * 0.38 + logoMatch * 0.2) * 100);
}

export function scoreLayout(geometry: DielineGeometry, design: LayoutDesign, settings: AutoLayoutSettings, preset: StylePreset): LayoutScoreBreakdown {
  const elements = foregroundElements(design);
  const overlapRatio = pairOverlapRatio(elements, preset.overlapTolerance);
  const safetyValues = elements.map((element) => packageSafetyScore(geometry, element.rect, element.role));
  const packageSafety = safetyValues.length
    ? (safetyValues.reduce((sum, score) => sum + score, 0) / safetyValues.length) * 100
    : 100;
  const lead = [...elements].sort((a, b) => b.weight - a.weight)[0];
  const leadSafety = lead ? packageSafetyScore(geometry, lead.rect, lead.role) : 1;
  const focalClarity = lead ? clampScore((leadSafety * 0.7 + (1 - Math.min(1, overlapFor(lead, elements))) * 0.3) * 100) : 100;
  const breakdown = {
    whitespace: whitespaceScore(geometry, elements, settings, preset),
    focalClarity,
    overlap: clampScore((1 - Math.min(1, overlapRatio * 2.8)) * 100),
    packageSafety: clampScore(packageSafety),
    readability: readabilityScore(geometry, design.texts, elements),
    weightBalance: balanceScore(geometry, elements),
    styleMatch: styleMatchScore(design, settings, preset),
  };
  let total = breakdown.whitespace * 0.25
    + breakdown.focalClarity * 0.2
    + breakdown.overlap * 0.15
    + breakdown.packageSafety * 0.15
    + breakdown.readability * 0.1
    + breakdown.weightBalance * 0.1
    + breakdown.styleMatch * 0.05;
  const criticalTextUnsafe = design.texts
    .filter((item) => item.text.trim())
    .some((item) => packageSafetyScore(geometry, textRect(item), item.role ?? "text") < 0.58);
  if (criticalTextUnsafe) total *= 0.48;
  if (leadSafety < 0.5) total *= 0.72;
  total = clampScore(total);
  return {
    ...breakdown,
    total,
    meetsThreshold: total >= 58 && !criticalTextUnsafe && packageSafety >= 62,
  };
}
