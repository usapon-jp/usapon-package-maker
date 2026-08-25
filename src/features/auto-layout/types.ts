import type { ArtworkLayer, StampItem, TextItem } from "../../app/app-types";

export type AutoLayoutTaste = "natural" | "pop" | "elegant";
export type AutoLayoutSize = "small" | "standard" | "large";
export type AutoLayoutDensity = "airy" | "standard" | "dense";
export type AutoLayoutTarget = "all" | "text" | "background" | "stamp";

export type AutoLayoutSettings = {
  taste: AutoLayoutTaste;
  size: AutoLayoutSize;
  density: AutoLayoutDensity;
  target: AutoLayoutTarget;
  logoEnabled: boolean;
};

export const DEFAULT_AUTO_LAYOUT_SETTINGS: AutoLayoutSettings = {
  taste: "natural",
  size: "standard",
  density: "standard",
  target: "all",
  logoEnabled: false,
};

export type LayoutDesign = {
  artworkLayers: ArtworkLayer[];
  stamps: StampItem[];
  texts: TextItem[];
};

export type LayoutScoreBreakdown = {
  whitespace: number;
  focalClarity: number;
  overlap: number;
  packageSafety: number;
  readability: number;
  weightBalance: number;
  styleMatch: number;
  total: number;
  meetsThreshold: boolean;
};

export type AutoLayoutResult = LayoutDesign & {
  score: LayoutScoreBreakdown;
  seed: number;
  signature: string;
  candidateCount: number;
  elapsedMs: number;
};

export type LayoutRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type StylePreset = {
  taste: AutoLayoutTaste;
  whitespaceTarget: number;
  panelInsetRatio: number;
  asymmetry: number;
  overlapTolerance: number;
  stampScale: number;
  stampRotations: number[];
  textScale: number;
  letterSpacingMm: number;
  lineHeight: number;
  normalFontWeight: 400 | 500 | 600 | 700 | 800 | 900;
};

export type SeededRandom = {
  next: () => number;
  between: (min: number, max: number) => number;
  pick: <T>(values: readonly T[]) => T;
};
