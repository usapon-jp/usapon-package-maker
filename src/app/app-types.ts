import type { BoxInput } from "../domain/boxes/types";

export type Screen = "home" | "size" | "design" | "print";

export type PatternItem = {
  id: string;
  kind: "pattern";
  fileName: string;
  sourceType: "png" | "svg";
  dataUrl: string;
  aspectRatio: number;
  tileWidthMm: number;
  offsetXmm: number;
  offsetYmm: number;
  repeat: boolean;
};

export type TextItem = {
  id: string;
  kind: "text";
  text: string;
  xMm: number;
  yMm: number;
  fontSizeMm: number;
  color: string;
};

export type AppState = {
  screen: Screen;
  box: BoxInput;
  pattern: PatternItem | null;
  texts: TextItem[];
  selectedTextId: string | null;
  showGuides: boolean;
  includeCalibrationPage: boolean;
};

export type AppAction =
  | { type: "go"; screen: Screen }
  | { type: "update-box"; field: keyof Omit<BoxInput, "type">; value: number }
  | { type: "set-pattern"; pattern: PatternItem | null }
  | { type: "update-pattern"; patch: Partial<PatternItem> }
  | { type: "add-text"; item: TextItem }
  | { type: "select-text"; id: string | null }
  | { type: "update-text"; id: string; patch: Partial<TextItem> }
  | { type: "remove-text"; id: string }
  | { type: "toggle-guides" }
  | { type: "set-calibration"; value: boolean };
