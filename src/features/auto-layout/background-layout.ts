import type { ArtworkLayer, QuarterTurn } from "../../app/app-types";
import type { DielineGeometry } from "../../domain/boxes/types";
import { clamp } from "../../domain/units";
import { DENSITY_SCALE, SIZE_SCALE } from "./style-presets";
import type { AutoLayoutSettings, SeededRandom, StylePreset } from "./types";

export type BackgroundLayoutType = "full" | "pattern";

export function backgroundLayoutType(item: ArtworkLayer): BackgroundLayoutType {
  return item.kind === "uploaded-artwork" && !item.repeat ? "full" : "pattern";
}

function coverWidth(geometry: DielineGeometry, aspectRatio: number, rotation: QuarterTurn) {
  const aspect = Math.max(0.05, aspectRatio);
  return rotation === 90 || rotation === 270
    ? Math.max(geometry.bounds.heightMm, geometry.bounds.widthMm * aspect)
    : Math.max(geometry.bounds.widthMm, geometry.bounds.heightMm * aspect);
}

function layoutFullBackground(
  item: Extract<ArtworkLayer, { kind: "uploaded-artwork" }>,
  geometry: DielineGeometry,
  preset: StylePreset,
  settings: AutoLayoutSettings,
  random: SeededRandom,
) {
  const rotations: QuarterTurn[] = preset.taste === "pop" ? [0, 0, 90, 270] : [0, 0, 0, 90];
  const rotationDeg = random.pick(rotations);
  const cropScale = preset.taste === "pop" ? random.between(1.08, 1.24) : preset.taste === "elegant" ? random.between(1.02, 1.1) : random.between(1.04, 1.16);
  const sizeInfluence = 0.92 + SIZE_SCALE[settings.size] * 0.08;
  const jitter = preset.asymmetry;
  return {
    ...item,
    rotationDeg,
    widthMm: clamp(coverWidth(geometry, item.aspectRatio, rotationDeg) * cropScale * sizeInfluence, 8, Math.max(geometry.bounds.widthMm, geometry.bounds.heightMm) * 3),
    offsetXmm: geometry.bounds.widthMm * (0.5 + random.between(-jitter, jitter) * 0.22),
    offsetYmm: geometry.bounds.heightMm * (0.5 + random.between(-jitter, jitter) * 0.22),
  };
}

function layoutPatternBackground(
  item: ArtworkLayer,
  geometry: DielineGeometry,
  preset: StylePreset,
  settings: AutoLayoutSettings,
  random: SeededRandom,
): ArtworkLayer {
  const shortSide = Math.max(12, Math.min(geometry.bounds.widthMm, geometry.bounds.heightMm));
  const sizeScale = SIZE_SCALE[settings.size];
  const density = DENSITY_SCALE[settings.density];
  const angle = random.pick(preset.taste === "pop" ? [0, 15, 30, 45, 60, 135] : preset.taste === "natural" ? [0, 15, 45, 135] : [0, 0, 45, 90]);

  if (item.kind === "stripe-pattern") {
    const stripeWidthMm = clamp(shortSide * 0.035 * sizeScale * random.between(0.85, 1.15), 1.5, 18);
    const gapMm = clamp(stripeWidthMm * density.spacing * random.between(0.8, 1.25), 1, 28);
    return {
      ...item,
      stripeWidthMm,
      gapMm,
      angleDeg: random.pick([0, 45, 90, 135]),
      offsetXmm: random.between(0, stripeWidthMm + gapMm),
      offsetYmm: random.between(0, stripeWidthMm + gapMm),
    };
  }

  if (item.kind === "dot-pattern") {
    const dotDiameterMm = clamp(shortSide * 0.045 * sizeScale * random.between(0.82, 1.18), 1.5, 24);
    const spacingMm = clamp(dotDiameterMm * (1.35 + density.spacing * 1.25), dotDiameterMm + 0.75, 70);
    return {
      ...item,
      dotDiameterMm,
      spacingMm,
      angleDeg: angle,
      offsetXmm: random.between(0, spacingMm),
      offsetYmm: random.between(0, spacingMm * 2),
    };
  }

  const widthMm = clamp(shortSide * 0.105 * sizeScale * random.between(0.82, 1.18), 3, 50);
  const sourceHeight = widthMm / Math.max(0.05, item.aspectRatio);
  const motifSize = Math.max(widthMm, sourceHeight);
  const repeatGapMm = clamp(motifSize * Math.max(0, density.spacing - 0.68) * random.between(0.7, 1.2), 0, 40);
  return {
    ...item,
    widthMm,
    repeatGapMm,
    rotationDeg: random.pick([0, 0, 90, 270] as const),
    offsetXmm: random.between(0, widthMm + repeatGapMm),
    offsetYmm: random.between(0, sourceHeight + repeatGapMm),
  };
}

export function layoutBackgrounds(
  artworkLayers: ArtworkLayer[],
  geometry: DielineGeometry,
  preset: StylePreset,
  settings: AutoLayoutSettings,
  random: SeededRandom,
) {
  return artworkLayers.map((item) => {
    if (!item.visible) return item;
    return backgroundLayoutType(item) === "full" && item.kind === "uploaded-artwork"
      ? layoutFullBackground(item, geometry, preset, settings, random)
      : layoutPatternBackground(item, geometry, preset, settings, random);
  });
}
