import type { BoxInput, BoxType } from "../domain/boxes/types";

export type Screen = "home" | "size" | "design" | "print";

export type ImageSourceType = "png" | "svg";
export type QuarterTurn = 0 | 90 | 180 | 270;

export type UploadedAsset = {
  id: string;
  fileName: string;
  sourceType: ImageSourceType;
  dataUrl: string;
  aspectRatio: number;
};

type ArtworkBase = {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  offsetXmm: number;
  offsetYmm: number;
};

export type UploadedArtworkLayer = ArtworkBase & UploadedAsset & {
  kind: "uploaded-artwork";
  widthMm: number;
  repeat: boolean;
  rotationDeg: QuarterTurn;
};

export type StripePatternLayer = ArtworkBase & {
  kind: "stripe-pattern";
  color: string;
  stripeWidthMm: number;
  gapMm: number;
  angleDeg: 0 | 45 | 90 | 135;
};

export type DotPatternLayer = ArtworkBase & {
  kind: "dot-pattern";
  color: string;
  dotDiameterMm: number;
  spacingMm: number;
};

export type ArtworkLayer = UploadedArtworkLayer | StripePatternLayer | DotPatternLayer;

export type StampItem = UploadedAsset & {
  kind: "stamp";
  name: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  rotationDeg: QuarterTurn;
  visible: boolean;
  opacity: number;
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

export type DielineLineColors = {
  cut: string;
  fold: string;
};

export type EditorSection = "artwork" | "stamps" | "text" | "display" | "lines";

export type AppState = {
  screen: Screen;
  box: BoxInput;
  backgroundColor: string;
  artworkLayers: ArtworkLayer[];
  stamps: StampItem[];
  selectedArtworkId: string | null;
  selectedStampId: string | null;
  texts: TextItem[];
  selectedTextId: string | null;
  openEditorSection: EditorSection;
  showGuides: boolean;
  lineColors: DielineLineColors;
  includeCalibrationPage: boolean;
};

export type AppAction =
  | { type: "go"; screen: Screen }
  | { type: "set-box-type"; boxType: BoxType }
  | { type: "update-box"; field: keyof Omit<BoxInput, "type">; value: number }
  | { type: "set-background-color"; color: string }
  | { type: "add-artwork"; item: ArtworkLayer }
  | { type: "select-artwork"; id: string | null }
  | { type: "update-artwork"; id: string; patch: Partial<ArtworkLayer> }
  | { type: "remove-artwork"; id: string }
  | { type: "duplicate-artwork"; id: string; newId: string }
  | { type: "move-artwork"; id: string; direction: "forward" | "backward" }
  | { type: "add-stamp"; item: StampItem }
  | { type: "select-stamp"; id: string | null }
  | { type: "update-stamp"; id: string; patch: Partial<StampItem> }
  | { type: "remove-stamp"; id: string }
  | { type: "duplicate-stamp"; id: string; newId: string }
  | { type: "move-stamp"; id: string; direction: "forward" | "backward" }
  | { type: "add-text"; item: TextItem }
  | { type: "select-text"; id: string | null }
  | { type: "update-text"; id: string; patch: Partial<TextItem> }
  | { type: "remove-text"; id: string }
  | { type: "set-open-editor-section"; section: EditorSection }
  | { type: "toggle-guides" }
  | { type: "set-line-color"; layer: keyof DielineLineColors; color: string }
  | { type: "set-line-colors"; colors: DielineLineColors }
  | { type: "set-calibration"; value: boolean };
