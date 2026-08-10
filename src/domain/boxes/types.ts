import type { Millimeters } from "../units";

export type Point = { x: Millimeters; y: Millimeters };
export type Line = { id: string; from: Point; to: Point };
export type PathShape = { id: string; d: string };
export type PolygonShape = { id: string; points: Point[] };

export type BoxInput = {
  type: "straight-tuck-carton-v1";
  widthMm: Millimeters;
  depthMm: Millimeters;
  heightMm: Millimeters;
  paperThicknessMm: Millimeters;
  glueFlapMm: Millimeters;
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

export type DielineGeometry = {
  type: BoxInput["type"];
  input: BoxInput;
  bounds: DielineBounds;
  bodyTopMm: Millimeters;
  bodyBottomMm: Millimeters;
  panels: Panel[];
  clipPolygons: PolygonShape[];
  layers: {
    cut: PathShape[];
    fold: Line[];
    glue: PolygonShape[];
    guide: Line[];
  };
};

export type BoxGenerator = (input: BoxInput) => DielineGeometry;
