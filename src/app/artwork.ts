import type {
  ArtworkLayer,
  BuiltInStampKey,
  DotPatternLayer,
  QuarterTurn,
  StampItem,
  StripePatternLayer,
  UploadedArtworkLayer,
  UploadedAsset,
} from "./app-types";
import type { DielineGeometry, DielinePageId, Panel } from "../domain/boxes/types";
import { AUTUMN_FREE_TRIAL_STAMP_ID, AUTUMN_STAMP_FILES, AUTUMN_STAMP_IDS, AUTUMN_TRIAL_STAMP_FILES, LEGACY_AUTUMN_STAMP_FILES } from "../features/theme-packs/autumn-stamp-catalog";

export const POFUMOFU_STAMP_FILE = "pofumofu-friends.png";
export const POFUMOFU_STAMP_KEY = "pofumofu-friends" as const;

export const BUILT_IN_STAMPS = [
  {
    key: "usapon-box-rabbits",
    fileName: "usapon-box-rabbits.png",
    name: "うさぽんBOX",
    themePackId: null,
    delivery: "public",
  },
  {
    key: POFUMOFU_STAMP_KEY,
    fileName: POFUMOFU_STAMP_FILE,
    name: "Pofumofu friends",
    themePackId: null,
    delivery: "public",
  },
  { key: "autumn-rabbit-sweet-potato-car", fileName: LEGACY_AUTUMN_STAMP_FILES["autumn-rabbit-sweet-potato-car"], name: "秋うさぎ（旧作品用）", themePackId: "autumn-letter-set", delivery: "private" as const, legacy: true },
  { key: "autumn-rabbit-acorn-hug", fileName: LEGACY_AUTUMN_STAMP_FILES["autumn-rabbit-acorn-hug"], name: "秋うさぎ（旧作品用）", themePackId: "autumn-letter-set", delivery: "private" as const, legacy: true },
  { key: "autumn-rabbit-sweet-potato", fileName: LEGACY_AUTUMN_STAMP_FILES["autumn-rabbit-sweet-potato"], name: "秋うさぎ（旧作品用）", themePackId: "autumn-letter-set", delivery: "private" as const, legacy: true },
  { key: "autumn-rabbit-chestnut", fileName: LEGACY_AUTUMN_STAMP_FILES["autumn-rabbit-chestnut"], name: "秋うさぎ（旧作品用）", themePackId: "autumn-letter-set", delivery: "private" as const, legacy: true },
  { key: "autumn-rabbit-sleeping-sweet-potato", fileName: LEGACY_AUTUMN_STAMP_FILES["autumn-rabbit-sleeping-sweet-potato"], name: "秋うさぎ（旧作品用）", themePackId: "autumn-letter-set", delivery: "private" as const, legacy: true },
  { key: "autumn-trial-cover", fileName: AUTUMN_TRIAL_STAMP_FILES["autumn-trial-cover"], name: "秋うさぎ表紙（無料お試し）", themePackId: null, delivery: "public" as const, trial: true },
  { key: "autumn-trial-sticky", fileName: AUTUMN_TRIAL_STAMP_FILES["autumn-trial-sticky"], name: "秋うさぎ付箋（無料お試し）", themePackId: null, delivery: "public" as const, trial: true },
  { key: "autumn-trial-heading", fileName: AUTUMN_TRIAL_STAMP_FILES["autumn-trial-heading"], name: "イチョウ見出し（無料お試し）", themePackId: null, delivery: "public" as const, trial: true },
  { key: "autumn-trial-tape", fileName: AUTUMN_TRIAL_STAMP_FILES["autumn-trial-tape"], name: "イチョウうさぎマステ（無料お試し）", themePackId: null, delivery: "public" as const, trial: true },
  ...AUTUMN_STAMP_IDS.map((key) => ({ key, fileName: AUTUMN_STAMP_FILES[key], name: key === AUTUMN_FREE_TRIAL_STAMP_ID ? "秋スタンプ（無料お試し）" : `秋スタンプ ${key.replace("autumn-stamp-", "")}`, themePackId: key === AUTUMN_FREE_TRIAL_STAMP_ID ? null : "autumn-letter-set", delivery: key === AUTUMN_FREE_TRIAL_STAMP_ID ? "public" as const : "private" as const })),
] as const satisfies ReadonlyArray<{ key: BuiltInStampKey; fileName: string; name: string; themePackId: string | null; delivery?: "public" | "private"; legacy?: boolean; trial?: boolean }>;

export function isBuiltInStampPickerVisible(preset: (typeof BUILT_IN_STAMPS)[number]) {
  return !("legacy" in preset && preset.legacy);
}

export function builtInStampForKey(key: BuiltInStampKey) {
  const preset = BUILT_IN_STAMPS.find((item) => item.key === key);
  if (!preset) throw new Error("内蔵スタンプが見つかりません。");
  return preset;
}

function runtimeAsset(asset: UploadedAsset) {
  const { id, assetRef, ...runtime } = asset;
  return {
    id,
    asset: {
      ...runtime,
      assetRef: assetRef ?? { kind: "user" as const, assetId: id },
    },
  };
}

export function markAsBuiltInStamp(asset: UploadedAsset, key: BuiltInStampKey = POFUMOFU_STAMP_KEY): UploadedAsset {
  return { ...asset, assetRef: { kind: "builtin", key } };
}

function panelCenter(geometry: DielineGeometry, targetPanel?: Panel) {
  const panel = targetPanel ?? geometry.panels[0];
  return { x: panel.x + panel.width / 2, y: panel.y + panel.height / 2, panel };
}

export function rotateQuarterTurn(rotation: QuarterTurn): QuarterTurn {
  return ((rotation + 90) % 360) as QuarterTurn;
}

export function createUploadedArtwork(asset: UploadedAsset, geometry: DielineGeometry, pageId: DielinePageId = "main"): UploadedArtworkLayer {
  const center = panelCenter(geometry);
  const widthMm = Math.min(50, Math.max(20, center.panel.width * 0.72));
  const runtime = runtimeAsset(asset);
  return {
    ...runtime.asset,
    id: runtime.id,
    kind: "uploaded-artwork",
    role: "background",
    pageId,
    name: asset.fileName,
    widthMm,
    offsetXmm: center.x,
    offsetYmm: center.y,
    repeat: false,
    repeatGapMm: 0,
    rotationDeg: 0,
    visible: true,
    opacity: 1,
  };
}

// Uses the existing uploaded-artwork layer. The full-page fit keeps the cover's
// aspect ratio intact, so the rabbit is not cropped when it is first placed.
export function createFullPanelArtwork(asset: UploadedAsset, geometry: DielineGeometry, pageId: DielinePageId = "main"): UploadedArtworkLayer {
  const item = createUploadedArtwork(asset, geometry, pageId);
  const panel = geometry.panels[0];
  item.widthMm = Math.min(panel.width, panel.height * asset.aspectRatio);
  item.offsetXmm = panel.x + panel.width / 2;
  item.offsetYmm = panel.y + panel.height / 2;
  return item;
}

export function createStripePattern(id: string, number: number, pageId: DielinePageId = "main"): StripePatternLayer {
  return {
    id,
    kind: "stripe-pattern",
    role: "background",
    pageId,
    name: `ストライプ ${number}`,
    color: "#f6d96f",
    stripeWidthMm: 5,
    gapMm: 5,
    angleDeg: 45,
    offsetXmm: 0,
    offsetYmm: 0,
    visible: true,
    opacity: 1,
  };
}

export function createDotPattern(id: string, number: number, pageId: DielinePageId = "main"): DotPatternLayer {
  return {
    id,
    kind: "dot-pattern",
    role: "background",
    pageId,
    name: `水玉 ${number}`,
    color: "#f6d96f",
    dotDiameterMm: 8,
    spacingMm: 24,
    angleDeg: 0,
    offsetXmm: 0,
    offsetYmm: 0,
    visible: true,
    opacity: 1,
  };
}

export function createStamp(asset: UploadedAsset, geometry: DielineGeometry, name = asset.fileName, pageId: DielinePageId = "main", targetPanel?: Panel): StampItem {
  const center = panelCenter(geometry, targetPanel);
  const runtime = runtimeAsset(asset);
  const baseWidth = Math.min(center.panel.width * 0.72, center.panel.height / Math.max(asset.aspectRatio, 0.35) * 0.72);
  return {
    ...runtime.asset,
    id: runtime.id,
    kind: "stamp",
    role: "stamp",
    pageId,
    name,
    xMm: center.x,
    yMm: center.y,
    widthMm: Math.min(40, Math.max(10, baseWidth)),
    rotationDeg: 0,
    visible: true,
    opacity: 1,
  };
}

export function rotateByDegrees(rotation: number, amount = 90) {
  return ((rotation + amount) % 360 + 360) % 360;
}

export function artworkKindLabel(item: ArtworkLayer) {
  if (item.kind === "stripe-pattern") return "STRIPE";
  if (item.kind === "dot-pattern") return "DOT";
  return item.sourceType.toUpperCase();
}
