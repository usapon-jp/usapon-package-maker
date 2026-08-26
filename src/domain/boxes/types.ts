import type { Millimeters } from "../units";

export type BoxType =
  | "straight-tuck-carton-v1"
  | "gift-box-v1"
  | "two-piece-gift-box-v1"
  | "letter-paper-v1"
  | "envelope-v1"
  | "mini-card-v1";

export type DielinePageId = "main" | "lid" | "base" | "letter" | "card";
export type StationerySetSelection = "envelope-only" | "envelope-letter" | "envelope-card" | "envelope-letter-card";

export type Point = { x: Millimeters; y: Millimeters };
export type Line = { id: string; from: Point; to: Point };
export type PathShape = { id: string; d: string };
export type PolygonShape = { id: string; points: Point[] };

export type BoxInput = {
  type: BoxType;
  widthMm: Millimeters;
  depthMm: Millimeters;
  heightMm: Millimeters;
  paperThicknessMm: Millimeters;
  glueFlapMm: Millimeters;
  lidDepthMm?: Millimeters;
  lidClearanceMm?: Millimeters;
  foldoverMm?: Millimeters;
};

export type Panel = {
  id: string;
  label: string;
  x: Millimeters;
  y: Millimeters;
  width: Millimeters;
  height: Millimeters;
};

export type DielineBounds = {
  x: 0;
  y: 0;
  widthMm: Millimeters;
  heightMm: Millimeters;
};

export type EnvelopeMetrics = {
  finishedWidthMm: Millimeters;
  finishedHeightMm: Millimeters;
  topFlapMm: Millimeters;
  bottomFlapMm: Millimeters;
  sideFlapMm: Millimeters;
  sideSeamGapMm: Millimeters;
  glueWidthMm: Millimeters;
  tipFlatMm: Millimeters;
};

export type DielineGeometry = {
  type: BoxInput["type"];
  input: BoxInput;
  bounds: DielineBounds;
  bodyTopMm: Millimeters;
  bodyBottomMm: Millimeters;
  envelope?: EnvelopeMetrics;
  panels: Panel[];
  clipPolygons: PolygonShape[];
  layers: {
    cut: PathShape[];
    fold: Line[];
    foldover: Line[];
    glue: PolygonShape[];
    guide: Line[];
  };
};

export type BoxGenerator = (input: BoxInput) => DielineGeometry;

export type DielinePage = {
  id: DielinePageId;
  label: string;
  geometry: DielineGeometry;
};

export type DielineDocument = {
  type: BoxType;
  input: BoxInput;
  pages: DielinePage[];
};
