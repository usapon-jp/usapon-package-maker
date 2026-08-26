import type { BoxInput, BoxType, DielinePageId, EnvelopeFaceId, StationerySetSelection } from "../domain/boxes/types";

export type Screen = "home" | "size" | "templates" | "design" | "print" | "my-boxes";

export type ImageSourceType = "png" | "svg";
export type QuarterTurn = 0 | 90 | 180 | 270;
export type DesignElementRole = "background" | "stamp" | "text" | "logoText";
export type EnvelopeTemplateStyle = "cute" | "adult" | "simple";
export type EnvelopeFlapPattern = "solid" | "dots" | "stripes";
export type PrintGuideMode = "assembly" | "design";
export type EnvelopeDesignSettings = {
  style: EnvelopeTemplateStyle;
  flapAccentEnabled: boolean;
  flapColor: string;
  flapPattern: EnvelopeFlapPattern;
  showAddressField: boolean;
  showAddressLines: boolean;
  marginMm: number;
};
export type TextAlignment = "start" | "middle" | "end";
export type TextFontWeight = 400 | 500 | 600 | 700 | 800 | 900;

export const BUILT_IN_STAMP_KEYS = [
  "pofumofu-friends",
  "usapon-box-rabbits",
  "autumn-rabbit-sweet-potato-car",
  "autumn-rabbit-acorn-hug",
  "autumn-rabbit-sweet-potato",
  "autumn-rabbit-chestnut",
  "autumn-rabbit-sleeping-sweet-potato",
] as const;
export type BuiltInStampKey = (typeof BUILT_IN_STAMP_KEYS)[number];

export type AssetRef =
  | { kind: "user"; assetId: string }
  | { kind: "builtin"; key: BuiltInStampKey };

export type UploadedAsset = {
  id: string;
  assetRef?: AssetRef;
  fileName: string;
  sourceType: ImageSourceType;
  dataUrl: string;
  aspectRatio: number;
  blob?: Blob;
};

export type RuntimeAsset = Omit<UploadedAsset, "id" | "assetRef"> & {
  assetRef: AssetRef;
};

type ArtworkBase = {
  id: string;
  role: "background";
  pageId: DielinePageId;
  name: string;
  visible: boolean;
  opacity: number;
  offsetXmm: number;
  offsetYmm: number;
  surfaceId?: EnvelopeFaceId;
  themePresetId?: string;
};

export type UploadedArtworkLayer = ArtworkBase & RuntimeAsset & {
  kind: "uploaded-artwork";
  widthMm: number;
  repeat: boolean;
  repeatGapMm: number;
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
  angleDeg: number;
};

export type ArtworkLayer = UploadedArtworkLayer | StripePatternLayer | DotPatternLayer;

export type StampItem = RuntimeAsset & {
  id: string;
  kind: "stamp";
  role: "stamp";
  pageId: DielinePageId;
  name: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  rotationDeg: number;
  visible: boolean;
  opacity: number;
  surfaceId?: EnvelopeFaceId;
  themePresetId?: string;
};

export type TextItem = {
  id: string;
  kind: "text";
  role: "text" | "logoText";
  pageId: DielinePageId;
  text: string;
  xMm: number;
  yMm: number;
  fontSizeMm: number;
  color: string;
  letterSpacingMm: number;
  lineHeight: number;
  alignment: TextAlignment;
  fontWeight: TextFontWeight;
  arcMm: number;
  strokeColor: string | null;
  strokeWidthMm: number;
  labelColor: string | null;
  labelPaddingMm: number;
  rotationDeg?: number;
  surfaceId?: EnvelopeFaceId;
  themePresetId?: string;
};

export type DielineLineColors = {
  cut: string;
  fold: string;
};

export type EditorSection = "auto-layout" | "artwork" | "stamps" | "text" | "display" | "lines";

export type AppState = {
  screen: Screen;
  box: BoxInput;
  templateId: string | null;
  showWritingLines: boolean;
  stationerySetSelection: StationerySetSelection;
  envelopeDesign: EnvelopeDesignSettings;
  activeEnvelopeFace: EnvelopeFaceId;
  surfaceBackgroundColors: Partial<Record<EnvelopeFaceId, string>>;
  themePackId: string | null;
  printGuideMode: PrintGuideMode;
  activePageId: DielinePageId;
  backgroundColors: Record<DielinePageId, string>;
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
  printFoldoverLines: boolean;
};

export type AppAction =
  | { type: "replace-state"; state: AppState }
  | { type: "go"; screen: Screen }
  | { type: "set-box-type"; boxType: BoxType }
  | { type: "replace-box"; box: BoxInput }
  | { type: "set-writing-lines"; value: boolean }
  | { type: "set-stationery-set-selection"; value: StationerySetSelection }
  | { type: "update-envelope-design"; patch: Partial<EnvelopeDesignSettings> }
  | { type: "set-envelope-face"; faceId: EnvelopeFaceId }
  | { type: "set-surface-background-color"; faceId: EnvelopeFaceId; color: string }
  | { type: "set-theme-pack"; themePackId: string | null }
  | { type: "apply-theme-pack"; themePackId: string; backgroundColors: Partial<Record<DielinePageId, string>>; surfaceBackgroundColors: Partial<Record<EnvelopeFaceId, string>>; lineColors: DielineLineColors; envelopeDesign: EnvelopeDesignSettings; textColor: string; stamps: StampItem[] }
  | { type: "set-print-guide-mode"; mode: PrintGuideMode }
  | { type: "set-active-page"; pageId: DielinePageId }
  | { type: "update-box"; field: keyof Omit<BoxInput, "type">; value: number }
  | { type: "set-background-color"; pageId: DielinePageId; color: string }
  | { type: "replace-page-background"; sourcePageId: DielinePageId; targetPageId: DielinePageId; items: ArtworkLayer[] }
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
  | { type: "apply-auto-layout"; pageId: DielinePageId; artworkLayers?: ArtworkLayer[]; stamps?: StampItem[]; texts?: TextItem[] }
  | { type: "replace-stationery-set-design"; pageIds: DielinePageId[]; backgroundColors: Partial<Record<DielinePageId, string>>; artworkLayers: ArtworkLayer[]; stamps: StampItem[]; texts: TextItem[] }
  | { type: "set-open-editor-section"; section: EditorSection }
  | { type: "toggle-guides" }
  | { type: "set-line-color"; layer: keyof DielineLineColors; color: string }
  | { type: "set-line-colors"; colors: DielineLineColors }
  | { type: "set-calibration"; value: boolean }
  | { type: "set-print-foldover-lines"; value: boolean };
