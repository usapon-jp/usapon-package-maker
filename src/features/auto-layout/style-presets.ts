import type { AutoLayoutDensity, AutoLayoutSize, AutoLayoutTaste, StylePreset } from "./types";

export const STYLE_PRESETS: Record<AutoLayoutTaste, StylePreset> = {
  natural: {
    taste: "natural",
    whitespaceTarget: 0.18,
    panelInsetRatio: 0.1,
    asymmetry: 0.1,
    overlapTolerance: 0.02,
    stampScale: 0.88,
    stampRotations: [-5, 0, 0, 0, 5],
    textScale: 0.9,
    letterSpacingMm: 0.28,
    lineHeight: 1.35,
    normalFontWeight: 600,
  },
  pop: {
    taste: "pop",
    whitespaceTarget: 0.3,
    panelInsetRatio: 0.07,
    asymmetry: 0.18,
    overlapTolerance: 0.12,
    stampScale: 1.14,
    stampRotations: [-18, -10, -5, 0, 8, 14, 18],
    textScale: 1.12,
    letterSpacingMm: 0.08,
    lineHeight: 1.14,
    normalFontWeight: 700,
  },
  elegant: {
    taste: "elegant",
    whitespaceTarget: 0.13,
    panelInsetRatio: 0.14,
    asymmetry: 0.035,
    overlapTolerance: 0,
    stampScale: 0.78,
    stampRotations: [-2, 0, 0, 0, 2],
    textScale: 0.82,
    letterSpacingMm: 0.48,
    lineHeight: 1.42,
    normalFontWeight: 500,
  },
};

export const SIZE_SCALE: Record<AutoLayoutSize, number> = {
  small: 0.78,
  standard: 1,
  large: 1.24,
};

export const DENSITY_SCALE: Record<AutoLayoutDensity, { coverage: number; spacing: number; cluster: number }> = {
  airy: { coverage: 0.72, spacing: 1.35, cluster: 0.35 },
  standard: { coverage: 1, spacing: 1, cluster: 0.62 },
  dense: { coverage: 1.18, spacing: 0.72, cluster: 0.9 },
};

export function stylePreset(taste: AutoLayoutTaste) {
  return STYLE_PRESETS[taste];
}
