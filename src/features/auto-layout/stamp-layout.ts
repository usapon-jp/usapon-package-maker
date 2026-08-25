import type { StampItem } from "../../app/app-types";
import type { DielineGeometry } from "../../domain/boxes/types";
import { clamp } from "../../domain/units";
import { DENSITY_SCALE, SIZE_SCALE } from "./style-presets";
import { intersectionArea, packagePanelRects, rectArea } from "./package-safe-area";
import type { AutoLayoutSettings, LayoutRect, SeededRandom, StylePreset } from "./types";

export function stampRect(item: StampItem): LayoutRect {
  const width = Math.max(2, item.widthMm);
  const height = width / Math.max(0.05, item.aspectRatio);
  const radians = item.rotationDeg * Math.PI / 180;
  const rotatedWidth = Math.abs(width * Math.cos(radians)) + Math.abs(height * Math.sin(radians));
  const rotatedHeight = Math.abs(width * Math.sin(radians)) + Math.abs(height * Math.cos(radians));
  return { x: item.xMm - rotatedWidth / 2, y: item.yMm - rotatedHeight / 2, width: rotatedWidth, height: rotatedHeight };
}

function positionInPanel(panel: LayoutRect, index: number, groupSize: number, random: SeededRandom, preset: StylePreset) {
  const single = [[0.5, 0.5]];
  const multiple = preset.taste === "elegant"
    ? [[0.32, 0.34], [0.68, 0.68], [0.7, 0.3], [0.3, 0.72], [0.5, 0.5]]
    : [[0.3, 0.32], [0.7, 0.68], [0.7, 0.28], [0.3, 0.72], [0.5, 0.5]];
  const templates = groupSize === 1 ? single : multiple;
  const [baseX, baseY] = templates[index % templates.length];
  return {
    x: panel.x + panel.width * clamp(baseX + random.between(-preset.asymmetry, preset.asymmetry), 0.12, 0.88),
    y: panel.y + panel.height * clamp(baseY + random.between(-preset.asymmetry, preset.asymmetry), 0.12, 0.88),
  };
}

function clampStampToPanel(stamp: StampItem, panel: LayoutRect) {
  const box = stampRect(stamp);
  const halfWidth = Math.min(panel.width / 2, box.width / 2);
  const halfHeight = Math.min(panel.height / 2, box.height / 2);
  return {
    ...stamp,
    xMm: clamp(stamp.xMm, panel.x + halfWidth, panel.x + panel.width - halfWidth),
    yMm: clamp(stamp.yMm, panel.y + halfHeight, panel.y + panel.height - halfHeight),
  };
}

export function layoutStamps(
  stamps: StampItem[],
  geometry: DielineGeometry,
  preset: StylePreset,
  settings: AutoLayoutSettings,
  random: SeededRandom,
) {
  const visible = stamps.filter((item) => item.visible);
  if (!visible.length) return stamps;
  const panels = packagePanelRects(geometry, preset.panelInsetRatio);
  if (!panels.length) return stamps;
  const sizeScale = SIZE_SCALE[settings.size] * DENSITY_SCALE[settings.density].coverage * preset.stampScale;
  const arranged = new Map<string, StampItem>();
  const placed: LayoutRect[] = [];
  const panelAssignments = visible.map((_, index) => {
    if (settings.density === "airy") return index % panels.length;
    if (index < 2) return 0;
    return Math.min(1 + ((index - 2) % Math.max(1, panels.length - 1)), panels.length - 1);
  });
  const panelCounts = panelAssignments.reduce((counts, panelIndex) => {
    counts.set(panelIndex, (counts.get(panelIndex) ?? 0) + 1);
    return counts;
  }, new Map<number, number>());
  const panelOffsets = new Map<number, number>();

  visible.forEach((item, index) => {
    const panelIndex = panelAssignments[index];
    const panel = panels[panelIndex].rect;
    const groupSize = panelCounts.get(panelIndex) ?? 1;
    const groupIndex = panelOffsets.get(panelIndex) ?? 0;
    panelOffsets.set(panelIndex, groupIndex + 1);
    const leadScale = index === 0 ? 1.12 : random.between(0.72, 0.92);
    const aspect = Math.max(0.05, item.aspectRatio);
    const slotFactor = groupSize === 1 ? 0.56 : groupSize === 2 ? 0.34 : 0.28;
    const maxWidthForHeight = panel.height * (groupSize === 1 ? 0.66 : 0.36) * aspect;
    const idealWidth = Math.min(panel.width * slotFactor, maxWidthForHeight) * sizeScale * leadScale;
    const widthCap = Math.min(panel.width * (groupSize === 1 ? 0.78 : 0.42), panel.height * (groupSize === 1 ? 0.72 : 0.43) * aspect);
    const widthMm = clamp(idealWidth, 3, Math.max(3, widthCap));
    const rotationDeg = random.pick(preset.stampRotations);
    let best = clampStampToPanel({ ...item, widthMm, rotationDeg, ...positionInPanel(panel, groupIndex, groupSize, random, preset) }, panel);
    let bestOverlap = Number.POSITIVE_INFINITY;
    for (let attempt = 0; attempt < 7; attempt += 1) {
      const trial = clampStampToPanel({ ...best, ...positionInPanel(panel, groupIndex + attempt, groupSize, random, preset) }, panel);
      const box = stampRect(trial);
      const overlap = placed.reduce((sum, other) => sum + intersectionArea(box, other) / Math.max(1, Math.min(rectArea(box), rectArea(other))), 0);
      if (overlap < bestOverlap) {
        best = trial;
        bestOverlap = overlap;
      }
    }
    arranged.set(item.id, best);
    placed.push(stampRect(best));
  });

  return stamps.map((item) => arranged.get(item.id) ?? item);
}
